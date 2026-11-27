#!/usr/bin/env python3
"""Local Web Server & WatcherManager cho VHU Register React UI.

Chạy: python web_ui.py [--port 8765] [--config config.mmc407.yaml]
"""
import argparse
import copy
import json
import mimetypes
import os
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import requests
import yaml

import register as core

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "frontend" / "dist"

SCHOOLS = {
    "vhu": {
        "config": "config.mmc407.yaml",
        "env_key": "TOKEN",
        "api_base": core.VHU_API_BASE,
        "headers": core.VHU_DEFAULT_HEADERS,
    },
    "huflit": {
        "config": "config.huflit.yaml",
        "env_key": "HUFLIT_TOKEN",
        "api_base": "https://dkmhapi.huflit.edu.vn/api/",
        "login_url": "https://dkmh.huflit.edu.vn/student",
        "headers": {
            "Content-Type": "application/json",
            "Origin": "https://dkmh.huflit.edu.vn",
            "Referer": "https://dkmh.huflit.edu.vn/",
        },
    },
}


class WatcherManager:
    """Quản lý token, TurnID, danh sách job canh nhiều môn và log realtime."""

    def __init__(
        self,
        school="vhu",
        config_path="config.mmc407.yaml",
        env_path=".env",
        env_key="TOKEN",
        api_base=core.VHU_API_BASE,
        headers=None,
        login_url=None,
    ):
        self.school = school
        self.config_path = str(BASE_DIR / config_path)
        self.env_path = str(BASE_DIR / env_path)
        self.env_key = env_key
        self.api_base = api_base
        self.headers = headers or core.VHU_DEFAULT_HEADERS
        self.login_url = login_url
        core.load_env(self.env_path)
        self.base_cfg = yaml.safe_load(open(self.config_path, encoding="utf-8"))
        self.session = core.make_session()
        self.lock = threading.RLock()
        self.jobs = {}
        self.logs = []
        self.turn_id = None
        self.quota = None
        self.login_blocked = False
        self.login_block_reason = ""
        self._login_in_flight = False
        self.browser_login_active = False
        self.browser_login_error = ""
        self.token_event = threading.Event()
        if os.environ.get(self.env_key):
            self.token_event.set()
        self._refresh_turn_id()

    def add_log(self, level, message, job_id=None, course_id=None):
        entry = {
            "id": uuid.uuid4().hex[:8],
            "time": datetime.now().strftime("%H:%M:%S"),
            "level": level,
            "message": message,
            "job_id": job_id,
            "course_id": course_id,
        }
        with self.lock:
            self.logs.append(entry)
            if len(self.logs) > 300:
                self.logs = self.logs[-300:]

    def _build_cfg(self, study_type="KH", program_id=None):
        cfg = copy.deepcopy(self.base_cfg)
        if program_id:
            cfg.setdefault("vars", {})["program_id"] = program_id
            if "watch" in cfg and isinstance(cfg["watch"].get("request", {}).get("body"), dict):
                cfg["watch"]["request"]["body"]["ReqParam1"] = program_id
        if study_type and "watch" in cfg and isinstance(cfg["watch"].get("request", {}).get("body"), dict):
            cfg["watch"]["request"]["body"]["ReqParam2"] = study_type
        if self.turn_id is not None:
            cfg.setdefault("vars", {})["turn_id"] = self.turn_id
        return cfg

    def _refresh_turn_id(self):
        token = os.environ.get(self.env_key, "")
        if not token:
            return False
        info = core.decode_jwt_info(token)
        prog_id = (info or {}).get("program_ids") or self.base_cfg.get("vars", {}).get("program_id")
        cfg = self._build_cfg(program_id=prog_id)
        status, tid = core.fetch_turn_id(self.session, cfg, retries=2)
        if status == "ok" and tid is not None:
            with self.lock:
                self.turn_id = tid
            return True
        return False

    def login(self, username, password, phonenumber=""):
        with self.lock:
            if self._login_in_flight:
                return False, "Đang xử lý yêu cầu đăng nhập, vui lòng không gửi lặp lại."
            if self.login_blocked:
                return False, (
                    f"Đã dừng đăng nhập để tránh spam/khóa tài khoản ({self.login_block_reason}). "
                    "Hệ thống không cho thử lại — hãy kiểm tra trực tiếp trên cổng trường hoặc dùng tab Dán Token thủ công."
                )
            self._login_in_flight = True

        try:
            ok, res = core.login_vhu(
                self.session,
                username,
                password,
                phonenumber=phonenumber,
                api_base=self.api_base,
                headers=self.headers,
                school_name=self.school.upper(),
            )
        finally:
            with self.lock:
                self._login_in_flight = False

        if not ok:
            reason = str(res)
            with self.lock:
                self.login_blocked = True
                self.login_block_reason = reason
            warn_msg = (
                f"Đăng nhập thất bại: {reason}. "
                "Đã dừng hẳn cơ chế đăng nhập để tránh spam/khóa tài khoản (không thử lại). "
                "Vui lòng kiểm tra trên cổng trường hoặc chuyển sang Dán Token thủ công."
            )
            self.add_log("error", f"🛑 {warn_msg}")
            return False, warn_msg
        token = core.save_env_token(res["Token"], self.env_path, env_key=self.env_key)
        self.token_event.set()
        self._refresh_turn_id()
        info = core.decode_jwt_info(token) or {}
        self.add_log("success", f"✅ Đăng nhập thành công: {res.get('FullName') or info.get('name')} ({res.get('Id') or info.get('id')})")
        return True, self.get_status()

    def set_token(self, token):
        clean = (token or "").strip().strip('"')
        if clean.lower().startswith("bearer "):
            clean = clean[7:].strip()
        info = core.decode_jwt_info(clean)
        if not info or not info.get("id"):
            return False, "Token không đúng định dạng JWT (cần chuỗi bắt đầu bằng eyJ..., không phải URL)."
        exp = info.get("exp")
        if exp and exp <= time.time():
            exp_str = datetime.fromtimestamp(exp).strftime("%H:%M:%S %d/%m/%Y")
            return False, f"Token này đã hết hạn lúc {exp_str}. Vui lòng lấy token mới từ cổng {self.school.upper()}."
        core.save_env_token(clean, self.env_path, env_key=self.env_key)
        with self.lock:
            self.login_blocked = False
            self.login_block_reason = ""
        self.token_event.set()
        ok = self._refresh_turn_id()
        self.add_log(
            "success" if ok else "warn",
            f"🔑 Đã cập nhật Token {self.school.upper()} cho {info.get('name')} ({info.get('id')})."
            + ("" if ok else " (Chưa lấy được TurnID — cổng có thể chưa mở đợt đăng ký)"),
        )
        return True, self.get_status()

    @staticmethod
    def _extract_valid_jwt(raw):
        """Trích xuất chuỗi JWT hợp lệ, chưa hết hạn từ header hoặc giá trị localStorage."""
        if not raw or not isinstance(raw, str):
            return None
        candidates = [raw]
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                for key in ("Token", "token", "access_token", "accessToken"):
                    val = parsed.get(key)
                    if isinstance(val, str):
                        candidates.insert(0, val)
            elif isinstance(parsed, str):
                candidates.insert(0, parsed)
        except Exception:
            pass
        now = time.time()
        for c in candidates:
            clean = c.strip().strip('"')
            if clean.lower().startswith("bearer "):
                clean = clean[7:].strip()
            info = core.decode_jwt_info(clean)
            if info and info.get("id"):
                exp = info.get("exp")
                if not exp or exp > now:
                    return clean
        return None

    def start_browser_login(self, timeout=300, username="", password=""):
        if not self.login_url:
            return False, f"Trường {self.school.upper()} chưa cấu hình đăng nhập qua trình duyệt."
        try:
            import playwright.sync_api  # noqa: F401
        except ImportError:
            return False, "Chưa cài Playwright. Hãy chạy: pip install playwright"

        with self.lock:
            if self.browser_login_active:
                return False, "Trình duyệt đăng nhập đang mở, vui lòng hoàn tất trên cửa sổ đó."
            self.browser_login_active = True
            self.browser_login_error = ""

        self.add_log("info", f"🌐 Đang mở trình duyệt đăng nhập {self.school.upper()} ({self.login_url})...")
        t = threading.Thread(
            target=self._run_browser_login,
            args=(timeout, (username or "").strip(), password or ""),
            daemon=True,
        )
        t.start()
        return True, self.get_status()

    def _launch_clean_browser(self, playwright, headless=True):
        """Mở Chrome/Edge phiên sạch (chạy ẩn khi có sẵn TK/MK, không lưu cookie/profile)."""
        base_kwargs = {
            "headless": headless,
            "chromium_sandbox": True,
            "ignore_default_args": ["--enable-automation"],
            "args": [
                "--no-first-run",
                "--no-default-browser-check",
                "--window-size=1280,900",
                "--password-store=basic",
            ],
        }
        last_err = None
        for channel in ("chrome", "msedge", None):
            try:
                kwargs = dict(base_kwargs)
                if channel:
                    kwargs["channel"] = channel
                return playwright.chromium.launch(**kwargs)
            except Exception as e:
                last_err = e
        raise last_err

    def _auto_login_huflit(self, page, username, password):
        """Tự động bấm Office 365 (bắt cả popup/tab mới) và điền TK/MK 1 lần, không spam thử lại."""
        if not username or not password:
            return None

        auth_page = page
        # 1. Bấm nút "Đăng nhập với Office 365" và bắt tab/popup mới do MSAL mở ra (nếu có)
        try:
            o365_btn = page.locator("button:has-text('Office 365')").first
            if o365_btn.is_visible(timeout=5000):
                try:
                    with page.context.expect_page(timeout=8000) as popup_info:
                        o365_btn.click()
                    auth_page = popup_info.value
                    auth_page.wait_for_load_state("domcontentloaded", timeout=15000)
                except Exception:
                    # Trường hợp chuyển trang ngay trên tab hiện tại
                    if len(page.context.pages) > 1:
                        auth_page = page.context.pages[-1]
        except Exception:
            pass

        # 2. Nếu Microsoft hiện trang "Pick an account", bấm "Use another account" để nhập đúng TK vừa điền
        try:
            other_acc = auth_page.locator("#otherTile").first
            if other_acc.is_visible(timeout=2000):
                other_acc.click()
        except Exception:
            pass

        # 3. Điền tài khoản / email Microsoft
        try:
            email_input = auth_page.locator("input[name='loginfmt'], input[type='email']").first
            email_input.wait_for(state="visible", timeout=15000)
            email_input.fill(username)
            auth_page.locator("#idSIButton9, input[type='submit']").first.click()
            auth_page.wait_for_timeout(800)
            err_el = auth_page.locator("#usernameError").first
            if err_el.is_visible(timeout=800):
                return f"Sai tài khoản/email: {err_el.inner_text().strip()}"
        except Exception:
            pass

        # 4. Điền mật khẩu Microsoft
        try:
            pwd_input = auth_page.locator("input[name='passwd'], input[type='password']").first
            pwd_input.wait_for(state="visible", timeout=15000)
            pwd_input.fill(password)
            auth_page.locator("#idSIButton9, input[type='submit']").first.click()
            auth_page.wait_for_timeout(1200)
            err_el = auth_page.locator("#passwordError").first
            if err_el.is_visible(timeout=1000):
                return f"Sai mật khẩu: {err_el.inner_text().strip()}"
        except Exception:
            return None

        # 5. Nếu hiện hỏi "Stay signed in?" thì bấm Yes (sau đó popup tự đóng về tab chính)
        try:
            if not auth_page.is_closed():
                kmsi = auth_page.locator("#KmsiDescription, input[name='DontShowAgain']").first
                if kmsi.is_visible(timeout=3000):
                    auth_page.locator("#idSIButton9, input[type='submit']").first.click()
        except Exception:
            pass

        return None

    def _run_browser_login(self, timeout=300, username="", password=""):
        from playwright.sync_api import sync_playwright

        found_token = {"value": None}
        api_host = urlparse(self.api_base).netloc.lower()
        existing_valid = self._extract_valid_jwt(os.environ.get(self.env_key, ""))
        browser = None
        context = None
        try:
            with sync_playwright() as p:
                browser = self._launch_clean_browser(p, headless=bool(username and password))
                context = browser.new_context(no_viewport=True)

                def accept_token(tok):
                    if not tok:
                        return False
                    if existing_valid and tok == existing_valid:
                        return False
                    found_token["value"] = tok
                    return True

                def on_request(req):
                    if found_token["value"]:
                        return
                    try:
                        if api_host and api_host not in req.url.lower():
                            return
                        auth = req.headers.get("authorization") or req.headers.get("Authorization")
                        accept_token(self._extract_valid_jwt(auth))
                    except Exception:
                        pass

                context.on("request", on_request)
                page = context.pages[0] if context.pages else context.new_page()
                page.bring_to_front()
                page.goto(self.login_url, wait_until="domcontentloaded", timeout=60000)

                if username and password and not found_token["value"]:
                    login_err = self._auto_login_huflit(page, username, password)
                    if login_err:
                        with self.lock:
                            self.browser_login_error = f"{login_err} (Đã dừng, không tự thử lại)."
                        self.add_log("error", f"🛑 {self.browser_login_error}")
                        return

                deadline = time.time() + timeout
                while time.time() < deadline and not found_token["value"]:
                    pages = list(context.pages)
                    if not pages or all(pg.is_closed() for pg in pages):
                        break
                    for pg in pages:
                        if pg.is_closed():
                            continue
                        try:
                            storage = pg.evaluate(
                                """() => {
                                    const out = {};
                                    for (let i = 0; i < localStorage.length; i++) {
                                        const k = localStorage.key(i);
                                        out[k] = localStorage.getItem(k);
                                    }
                                    return out;
                                }"""
                            )
                            if isinstance(storage, dict):
                                values = []
                                if "authorizationData" in storage:
                                    values.append(storage["authorizationData"])
                                values.extend(v for k, v in storage.items() if k != "authorizationData")
                                for val in values:
                                    if accept_token(self._extract_valid_jwt(val)):
                                        break
                        except Exception:
                            pass
                        if found_token["value"]:
                            break
                    if not found_token["value"]:
                        try:
                            alive = next((pg for pg in context.pages if not pg.is_closed()), None)
                            if alive is None:
                                break
                            alive.wait_for_timeout(500)
                        except Exception:
                            time.sleep(0.5)

                if found_token["value"]:
                    ok, res = self.set_token(found_token["value"])
                    if not ok:
                        with self.lock:
                            self.browser_login_error = str(res)
                        self.add_log("error", f"❌ Lưu Token {self.school.upper()} thất bại: {res}")
                else:
                    msg = "Đã đóng trình duyệt hoặc hết thời gian chờ trước khi lấy được Token."
                    with self.lock:
                        self.browser_login_error = msg
                    self.add_log("warn", f"⚠️ {msg}")
        except Exception as e:
            msg = f"Lỗi mở trình duyệt Playwright: {e}"
            with self.lock:
                self.browser_login_error = msg
            self.add_log("error", f"❌ {msg}")
        finally:
            if context is not None:
                try:
                    context.close()
                except Exception:
                    pass
            if browser is not None:
                try:
                    browser.close()
                except Exception:
                    pass
            with self.lock:
                self.browser_login_active = False

    def lookup_course(self, raw_code, study_type="KH"):
        code = (raw_code or "").strip().upper()
        if not code:
            return False, "Vui lòng nhập mã môn."
        default_prefix = "262" if self.school == "vhu" else ""
        prefix = str(self.base_cfg.get("term_prefix", default_prefix))
        course_id = code if (not prefix or code.startswith(prefix)) else prefix + code
        info = core.decode_jwt_info(os.environ.get(self.env_key, "")) or {}
        prog_id = info.get("program_ids") or self.base_cfg.get("vars", {}).get("program_id")
        cfg = self._build_cfg(study_type=study_type, program_id=prog_id)
        if self.turn_id is None:
            self._refresh_turn_id()
            cfg = self._build_cfg(study_type=study_type, program_id=prog_id)
        base = {"course_id": course_id, **cfg.get("vars", {}), "class_id": ""}
        items = core.fetch_items(self.session, cfg, base)
        if items == "auth":
            return False, "Token hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
        if not isinstance(items, dict):
            return False, "Lỗi kết nối khi tải danh sách lớp."
        if not items:
            return False, f"Không tìm thấy lớp nào cho môn {course_id} ({study_type})."
        classes = sorted(items.values(), key=lambda x: x.get("CurriculumID", ""))
        return True, {"course_id": course_id, "study_type": study_type, "classes": classes}

    def start_job(self, course_id, class_ids, interval=1.0, dry_run=False, study_type="KH"):
        if not class_ids:
            return False, "Chưa chọn lớp nào để canh."
        job_id = uuid.uuid4().hex[:8]
        stop_event = threading.Event()
        job = {
            "id": job_id,
            "course_id": course_id,
            "study_type": study_type,
            "class_ids": list(class_ids),
            "interval": max(0.4, float(interval or 1.0)),
            "dry_run": bool(dry_run),
            "status": "running",
            "rounds": 0,
            "slots": {cid: "?" for cid in class_ids},
            "result": None,
            "stop_event": stop_event,
        }
        with self.lock:
            self.jobs[job_id] = job
        t = threading.Thread(target=self._run_job, args=(job_id,), daemon=True)
        t.start()
        mode = "[THỬ] " if dry_run else ""
        self.add_log("info", f"👀 {mode}Bắt đầu canh {course_id} ({len(class_ids)} lớp)", job_id=job_id, course_id=course_id)
        return True, self._public_job(job)

    def stop_job(self, job_id):
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return False, "Không tìm thấy job."
            job["stop_event"].set()
            if job["status"] in ("running", "waiting_token"):
                job["status"] = "stopped"
        self.add_log("warn", f"⏹ Đã dừng canh {job['course_id']}", job_id=job_id, course_id=job["course_id"])
        return True, True

    def clear_finished(self):
        with self.lock:
            to_del = [jid for jid, j in self.jobs.items() if j["status"] in ("stopped", "success", "error")]
            for jid in to_del:
                del self.jobs[jid]
        return len(to_del)

    def _run_job(self, job_id):
        info = core.decode_jwt_info(os.environ.get(self.env_key, "")) or {}
        prog_id = info.get("program_ids") or self.base_cfg.get("vars", {}).get("program_id")
        while True:
            with self.lock:
                job = self.jobs.get(job_id)
                if not job or job["stop_event"].is_set():
                    return
                course_id = job["course_id"]
                class_ids = list(job["class_ids"])
                interval = job["interval"]
                dry_run = job["dry_run"]
                study_type = job["study_type"]

            if self.turn_id is None:
                self._refresh_turn_id()
            cfg = self._build_cfg(study_type=study_type, program_id=prog_id)
            base = {"course_id": course_id, **cfg.get("vars", {})}
            items = core.fetch_items(self.session, cfg, {**base, "class_id": ""})
            if items == "auth":
                with self.lock:
                    job["status"] = "waiting_token"
                self.token_event.clear()
                self.add_log("auth", f"🔑 Token hết hạn! Đang tạm dừng {course_id} chờ đăng nhập lại...", job_id=job_id, course_id=course_id)
                while not job["stop_event"].is_set() and not self.token_event.wait(timeout=1.0):
                    pass
                if job["stop_event"].is_set():
                    return
                with self.lock:
                    job["status"] = "running"
                continue

            if items is None:
                self.add_log("warn", f"⚠️ Lỗi mạng khi kiểm tra {course_id}, thử lại...", job_id=job_id, course_id=course_id)
                job["stop_event"].wait(interval)
                continue

            with self.lock:
                job["rounds"] += 1
                for cid in class_ids:
                    it = items.get(cid)
                    job["slots"][cid] = str(it.get("NumberRegistOfEmpty", "?")) if it else "?"

            for cid in class_ids:
                if job["stop_event"].is_set():
                    return
                it = items.get(cid)
                n = int((it or {}).get("NumberRegistOfEmpty") or 0)
                if n <= 0:
                    continue
                mode = "[THỬ] " if dry_run else ""
                self.add_log("slot", f"🔔 {mode}CÓ CHỖ TRỐNG ở {cid} ({n} chỗ) -> đang đăng ký...", job_id=job_id, course_id=course_id)
                ctx = {**base, "class_id": cid, "_item": it}
                try:
                    res = core.try_register(self.session, cfg, ctx, dry_run)
                except requests.RequestException as e:
                    self.add_log("warn", f"⚠️ Lỗi mạng khi đăng ký {cid}: {type(e).__name__}", job_id=job_id, course_id=course_id)
                    res = "retry"

                if res == "success":
                    with self.lock:
                        job["status"] = "success"
                        job["result"] = cid
                    self.add_log("success", f"✅ {mode}ĐĂNG KÝ THÀNH CÔNG: {cid}", job_id=job_id, course_id=course_id)
                    return
                if res == "auth":
                    with self.lock:
                        job["status"] = "waiting_token"
                    self.token_event.clear()
                    self.add_log("auth", f"🔑 Token hết hạn khi đăng ký {cid}!", job_id=job_id, course_id=course_id)
                    break
                if res == "full":
                    self.add_log("warn", f"⏳ {cid} vừa đầy (có người nhanh hơn), thử lớp khác...", job_id=job_id, course_id=course_id)
                elif res == "retry":
                    self.add_log("warn", "🔁 Server bận, thử lại...", job_id=job_id, course_id=course_id)
                    break
                else:
                    self.add_log("error", f"❌ {cid} bị từ chối: {res}", job_id=job_id, course_id=course_id)

            job["stop_event"].wait(interval)

    def _public_job(self, job):
        return {k: v for k, v in job.items() if k != "stop_event"}

    def _portal_request(self, method, rel_path, params=None, payload=None, timeout=10):
        token = os.environ.get(self.env_key, "")
        if not token:
            return False, "Chưa có Token. Vui lòng đăng nhập trước."
        headers = {**self.headers, "Authorization": f"Bearer {token}"}
        url = self.api_base + rel_path.lstrip("/")
        try:
            r = self.session.request(method, url, headers=headers, params=params, json=payload, timeout=timeout)
            if r.status_code in (401, 403):
                return False, "Token hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
            try:
                data = r.json()
            except Exception:
                data = None
            if not r.ok:
                msg = (data.get("message") or data.get("Message") or data.get("error")) if isinstance(data, dict) else r.text[:200]
                return False, msg or f"Lỗi API {rel_path} (HTTP {r.status_code})"
            return True, data
        except requests.RequestException as e:
            return False, f"Lỗi kết nối máy chủ {self.school.upper()}: {type(e).__name__}"

    def _resolve_program_id(self, program_id=None):
        if program_id:
            return program_id
        info = core.decode_jwt_info(os.environ.get(self.env_key, "")) or {}
        if info.get("program_ids"):
            return str(info["program_ids"]).split(",")[0].strip()
        ok, progs = self.get_study_programs()
        if ok and isinstance(progs, list) and progs:
            return progs[0].get("StudyProgramID") or ""
        return self.base_cfg.get("vars", {}).get("program_id", "")

    def get_study_programs(self):
        """1. GET Authen/GetAllStudyProgramRegist"""
        return self._portal_request("GET", "Authen/GetAllStudyProgramRegist")

    def get_credit_quota(self, program_id=None):
        """2. GET Regist/GetRegistSemesterCreditQuota?StudyProgramID=..."""
        prog_id = self._resolve_program_id(program_id)
        if not prog_id:
            return False, "Không xác định được mã chương trình đào tạo (StudyProgramID)."
        ok, data = self._portal_request(
            "GET",
            "Regist/GetRegistSemesterCreditQuota",
            params={"StudyProgramID": prog_id},
        )
        if ok and isinstance(data, dict):
            with self.lock:
                self.quota = data
                if data.get("IdDot") is not None:
                    self.turn_id = data.get("IdDot")
        return ok, data

    def get_study_types(self):
        """3. GET Authen/GetAllStudyType"""
        ok, data = self._portal_request("GET", "Authen/GetAllStudyType")
        if ok and isinstance(data, list):
            items = [x for x in data if x.get("HienThi", True)]
            items.sort(key=lambda x: x.get("ThuTu") or 0)
            return True, items
        return ok, data

    def get_registered_classes(self, turn_id=None, program_id=None):
        """4. POST Regist/GetAllClassRegisted"""
        tid = turn_id if turn_id not in (None, "") else self.turn_id
        if tid in (None, "", 0):
            ok_q, qdata = self.get_credit_quota(program_id=program_id)
            if ok_q and isinstance(qdata, dict):
                tid = qdata.get("IdDot")
        if tid in (None, ""):
            return False, "Chưa lấy được mã đợt đăng ký (IdDot)."
        ok, data = self._portal_request(
            "POST",
            "Regist/GetAllClassRegisted",
            payload={"ReqParam1": "0", "ReqParam2": str(tid)},
        )
        if ok and isinstance(data, dict):
            return True, {"turn_id": tid, "rows": data.get("Rows") or [], "raw": data}
        return ok, data

    def get_allow_regist_classes(
        self,
        study_type="KH",
        program_id=None,
        year_study=None,
        term_id=None,
        keyword="",
    ):
        """5. POST Regist/GetAllClassAllowRegist"""
        prog_id = self._resolve_program_id(program_id)
        quota = self.quota if isinstance(self.quota, dict) else None
        if not year_study or not term_id:
            if not quota or not quota.get("YearStudy") or not quota.get("TermID"):
                ok_q, qdata = self.get_credit_quota(program_id=prog_id)
                if ok_q and isinstance(qdata, dict):
                    quota = qdata
            year_study = year_study or (quota or {}).get("YearStudy") or ""
            term_id = term_id or (quota or {}).get("TermID") or ""
        if not prog_id:
            return False, "Không xác định được mã chương trình đào tạo (StudyProgramID)."
        payload = {
            "ReqParam1": str(prog_id),
            "ReqParam2": str(study_type or "KH"),
            "ReqParam3": str(year_study or ""),
            "ReqParam4": str(term_id or ""),
            "ReqParam5": str(keyword or ""),
        }
        ok, data = self._portal_request("POST", "Regist/GetAllClassAllowRegist", payload=payload)
        if ok:
            rows = data.get("Rows", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            return True, {
                "program_id": prog_id,
                "study_type": payload["ReqParam2"],
                "year_study": payload["ReqParam3"],
                "term_id": payload["ReqParam4"],
                "rows": rows,
            }
        return ok, data

    def get_portal_overview(self, study_type=None, program_id=None):
        """Gọi đồng bộ cả 5 API cổng trường (không hardcode dữ liệu)."""
        out = {
            "programs": [],
            "program_id": None,
            "quota": None,
            "study_types": [],
            "active_study_type": None,
            "registered": [],
            "allow_regist": [],
            "errors": {},
        }
        ok_p, progs = self.get_study_programs()
        if ok_p and isinstance(progs, list):
            out["programs"] = progs
        else:
            out["errors"]["programs"] = progs

        prog_id = program_id or (progs[0].get("StudyProgramID") if ok_p and isinstance(progs, list) and progs else None) or self._resolve_program_id()
        out["program_id"] = prog_id

        ok_q, quota = self.get_credit_quota(program_id=prog_id)
        if ok_q and isinstance(quota, dict):
            out["quota"] = quota
        else:
            out["errors"]["quota"] = quota

        ok_st, stypes = self.get_study_types()
        if ok_st and isinstance(stypes, list):
            out["study_types"] = stypes
        else:
            out["errors"]["study_types"] = stypes

        chosen_st = study_type
        if not chosen_st and out["study_types"]:
            # Ưu tiên loại hình đầu tiên được mở theo MapID trong quota, hoặc KH nếu có
            enabled = []
            for st in out["study_types"]:
                map_id = st.get("MapID")
                if not map_id or (isinstance(out["quota"], dict) and bool(out["quota"].get(map_id))):
                    enabled.append(st)
            kh = next((x for x in enabled if x.get("LoaiHinh") == "KH"), None)
            chosen_st = (kh or (enabled[0] if enabled else out["study_types"][0])).get("LoaiHinh")
        out["active_study_type"] = chosen_st or "KH"

        tid = out["quota"].get("IdDot") if isinstance(out["quota"], dict) else self.turn_id
        ok_reg, reg_data = self.get_registered_classes(turn_id=tid, program_id=prog_id)
        if ok_reg and isinstance(reg_data, dict):
            out["registered"] = reg_data.get("rows") or []
        else:
            out["errors"]["registered"] = reg_data

        ok_allow, allow_data = self.get_allow_regist_classes(
            study_type=out["active_study_type"],
            program_id=prog_id,
            year_study=(out["quota"] or {}).get("YearStudy") if isinstance(out["quota"], dict) else None,
            term_id=(out["quota"] or {}).get("TermID") if isinstance(out["quota"], dict) else None,
        )
        if ok_allow and isinstance(allow_data, dict):
            out["allow_regist"] = allow_data.get("rows") or []
        else:
            out["errors"]["allow_regist"] = allow_data

        return True, out

    def get_status(self):
        token = os.environ.get(self.env_key, "")
        info = core.decode_jwt_info(token)
        now = time.time()
        exp = info["exp"] if info and info.get("exp") else None
        remaining = max(0, int(exp - now)) if exp else 0
        with self.lock:
            return {
                "school": self.school,
                "user": info,
                "has_token": bool(token),
                "token_valid": bool(info and exp and exp > now),
                "expires_at": datetime.fromtimestamp(exp).strftime("%H:%M:%S %d/%m/%Y") if exp else None,
                "remaining_seconds": remaining,
                "turn_id": self.turn_id,
                "login_blocked": self.login_blocked,
                "login_block_reason": self.login_block_reason,
                "browser_login_active": self.browser_login_active,
                "browser_login_error": self.browser_login_error,
                "jobs": [self._public_job(j) for j in self.jobs.values()],
                "logs": list(self.logs[-120:]),
            }


def make_handler(managers):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            pass  # giữ terminal gọn

        def _get_manager(self, school):
            return managers.get(school) or managers["vhu"]

        def _send_json(self, code, obj):
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _read_json(self):
            n = int(self.headers.get("Content-Length", "0") or 0)
            if n == 0:
                return {}
            return json.loads(self.rfile.read(n).decode("utf-8"))

        def do_GET(self):
            parsed = urlparse(self.path)
            path = parsed.path
            qs = parse_qs(parsed.query)
            school = qs.get("school", ["vhu"])[0]
            if path == "/api/status":
                return self._send_json(HTTPStatus.OK, self._get_manager(school).get_status())
            if path == "/api/portal/programs":
                ok, data = self._get_manager(school).get_study_programs()
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/portal/quota":
                prog_id = qs.get("program_id", [None])[0]
                ok, data = self._get_manager(school).get_credit_quota(program_id=prog_id)
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/portal/study-types":
                ok, data = self._get_manager(school).get_study_types()
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/portal/registered":
                tid = qs.get("turn_id", [None])[0]
                prog_id = qs.get("program_id", [None])[0]
                ok, data = self._get_manager(school).get_registered_classes(turn_id=tid, program_id=prog_id)
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/portal/overview":
                st = qs.get("study_type", [None])[0]
                prog_id = qs.get("program_id", [None])[0]
                ok, data = self._get_manager(school).get_portal_overview(study_type=st, program_id=prog_id)
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if not DIST_DIR.exists():
                return self._send_json(HTTPStatus.NOT_FOUND, {"error": "Chưa build React UI (chạy npm run build trong frontend/)"})
            rel = "index.html" if path == "/" else path.lstrip("/")
            target = (DIST_DIR / rel).resolve()
            if not str(target).startswith(str(DIST_DIR.resolve())) or not target.is_file():
                target = DIST_DIR / "index.html"
            mime, _ = mimetypes.guess_type(str(target))
            data = target.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_POST(self):
            path = urlparse(self.path).path
            try:
                body = self._read_json()
            except Exception:
                return self._send_json(HTTPStatus.BAD_REQUEST, {"ok": False, "error": "JSON không hợp lệ"})

            manager = self._get_manager(body.get("school", "vhu"))

            if path == "/api/login":
                ok, data = manager.login(
                    body.get("username", ""),
                    body.get("password", ""),
                    body.get("phonenumber", ""),
                )
                return self._send_json(
                    HTTPStatus.OK if ok else (HTTPStatus.TOO_MANY_REQUESTS if manager.login_blocked else HTTPStatus.UNAUTHORIZED),
                    {"ok": ok, "data": data if ok else None, "error": None if ok else data, "blocked": manager.login_blocked},
                )
            if path == "/api/login/browser":
                ok, data = manager.start_browser_login(
                    username=body.get("username", ""),
                    password=body.get("password", ""),
                )
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/token":
                ok, data = manager.set_token(body.get("token", ""))
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/lookup":
                ok, data = manager.lookup_course(body.get("course_id", ""), body.get("study_type", "KH"))
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/portal/allow-regist":
                ok, data = manager.get_allow_regist_classes(
                    study_type=body.get("study_type", "KH"),
                    program_id=body.get("program_id"),
                    year_study=body.get("year_study"),
                    term_id=body.get("term_id"),
                    keyword=body.get("keyword", ""),
                )
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/jobs/start":
                ok, data = manager.start_job(
                    body.get("course_id", ""),
                    body.get("class_ids", []),
                    body.get("interval", 1.0),
                    body.get("dry_run", False),
                    body.get("study_type", "KH"),
                )
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "job": data if ok else None, "error": None if ok else data})
            if path == "/api/jobs/stop":
                ok, res = manager.stop_job(body.get("job_id", ""))
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.NOT_FOUND, {"ok": ok, "error": None if ok else res})
            if path == "/api/jobs/clear":
                removed = manager.clear_finished()
                return self._send_json(HTTPStatus.OK, {"ok": True, "removed": removed})
            return self._send_json(HTTPStatus.NOT_FOUND, {"ok": False, "error": "Not found"})

    return Handler


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--config", default="config.mmc407.yaml")
    ap.add_argument("--no-browser", action="store_true")
    args = ap.parse_args()

    managers = {}
    for sid, scfg in SCHOOLS.items():
        cfg_file = args.config if sid == "vhu" else scfg["config"]
        managers[sid] = WatcherManager(
            school=sid,
            config_path=cfg_file,
            env_key=scfg["env_key"],
            api_base=scfg["api_base"],
            headers=scfg["headers"],
            login_url=scfg.get("login_url"),
        )
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(managers))
    url = f"http://127.0.0.1:{args.port}"
    print(f"Course Auto-Register Web UI đang chạy tại {url} (Ctrl+C để dừng)")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐang dừng...")
        server.shutdown()


if __name__ == "__main__":
    main()
