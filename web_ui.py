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
    ):
        self.school = school
        self.config_path = str(BASE_DIR / config_path)
        self.env_path = str(BASE_DIR / env_path)
        self.env_key = env_key
        self.api_base = api_base
        self.headers = headers or core.VHU_DEFAULT_HEADERS
        core.load_env(self.env_path)
        self.base_cfg = yaml.safe_load(open(self.config_path, encoding="utf-8"))
        self.session = core.make_session()
        self.lock = threading.RLock()
        self.jobs = {}
        self.logs = []
        self.turn_id = None
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
        ok, res = core.login_vhu(
            self.session,
            username,
            password,
            phonenumber=phonenumber,
            api_base=self.api_base,
            headers=self.headers,
            school_name=self.school.upper(),
        )
        if not ok:
            self.add_log("error", f"❌ Đăng nhập thất bại: {res}")
            return False, res
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
        self.token_event.set()
        ok = self._refresh_turn_id()
        self.add_log(
            "success" if ok else "warn",
            f"🔑 Đã cập nhật Token {self.school.upper()} cho {info.get('name')} ({info.get('id')})."
            + ("" if ok else " (Chưa lấy được TurnID — cổng có thể chưa mở đợt đăng ký)"),
        )
        return True, self.get_status()

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
            if path == "/api/status":
                qs = parse_qs(parsed.query)
                school = qs.get("school", ["vhu"])[0]
                return self._send_json(HTTPStatus.OK, self._get_manager(school).get_status())
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
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.UNAUTHORIZED, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/token":
                ok, data = manager.set_token(body.get("token", ""))
                return self._send_json(HTTPStatus.OK if ok else HTTPStatus.BAD_REQUEST, {"ok": ok, "data": data if ok else None, "error": None if ok else data})
            if path == "/api/lookup":
                ok, data = manager.lookup_course(body.get("course_id", ""), body.get("study_type", "KH"))
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
