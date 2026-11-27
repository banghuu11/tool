#!/usr/bin/env python3
"""Tool tự đăng ký môn cho tài khoản của chính bạn.

Dùng: python register.py [--config config.yaml] [--dry-run]
Token/cookie lấy từ .env (không hard-code). Không xử lý CAPTCHA.
"""
import argparse
import base64
import json
import logging
import os
import time
from datetime import datetime

import requests
import yaml

log = logging.getLogger("register")

VHU_API_BASE = "https://regist_api.vhu.edu.vn/api/"
VHU_DEFAULT_HEADERS = {
    "apiKey": "pscRBF0zT2Mqo6vMw69YMOH43IrB2RtXBS0EHit2kzv",
    "clientId": "dtl",
    "Content-Type": "application/json",
}


class WildcardHostAdapter(requests.adapters.HTTPAdapter):
    """Host có dấu '_' (regist_api) không khớp wildcard theo quy tắc của Python.
    Vẫn xác minh chuỗi chứng chỉ; chỉ đối chiếu tên với 'regist.vhu.edu.vn'
    (nằm trong *.vhu.edu.vn của chứng chỉ). KHÔNG tắt xác thực SSL."""

    def init_poolmanager(self, *args, **kwargs):
        kwargs["assert_hostname"] = "regist.vhu.edu.vn"
        super().init_poolmanager(*args, **kwargs)


def make_session():
    s = requests.Session()
    s.mount("https://regist_api.vhu.edu.vn", WildcardHostAdapter())
    return s


def load_env(path=".env"):
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def save_env_token(token, path=".env", env_key="TOKEN"):
    """Lưu token mới vào os.environ và cập nhật file .env."""
    token = token.strip().strip('"')
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    os.environ[env_key] = token
    lines = []
    found = False
    prefix = f"{env_key}="
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith(prefix):
                    lines.append(f"{env_key}={token}\n")
                    found = True
                else:
                    lines.append(line)
    if not found:
        lines.insert(0, f"{env_key}={token}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    return token


def decode_jwt_info(token):
    """Giải mã payload JWT (không verify chữ ký) để lấy thông tin sinh viên và hạn token."""
    if not token or token.count(".") != 2:
        return None
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        return {
            "id": data.get("Id", ""),
            "name": data.get("Name", ""),
            "role": data.get("Role", ""),
            "program_ids": data.get("StudyProgramIds", ""),
            "exp": data.get("exp"),
        }
    except Exception:
        return None


def login_vhu(
    session,
    username,
    password,
    phonenumber="",
    timeout=10,
    api_base=VHU_API_BASE,
    headers=None,
    school_name="VHU",
):
    """Đăng nhập tài khoản sinh viên qua API Authen/Authenticate."""
    url = api_base + "Authen/Authenticate"
    payload = {"username": username.strip(), "password": password, "phonenumber": (phonenumber or "").strip()}
    try:
        r = session.post(url, headers=headers or VHU_DEFAULT_HEADERS, json=payload, timeout=timeout)
        try:
            data = r.json()
        except Exception:
            data = None
        if r.ok and isinstance(data, dict) and data.get("Token"):
            return True, data
        msg = (data.get("message") or data.get("Message") or data.get("error")) if isinstance(data, dict) else r.text[:200]
        return False, msg or f"Đăng nhập thất bại (HTTP {r.status_code})"
    except requests.RequestException as e:
        return False, f"Lỗi kết nối máy chủ {school_name}: {type(e).__name__}"


def fetch_turn_id(session, cfg, retries=10):
    """Lấy TurnID (IdDot) từ API cấu hình trong cfg['turn_lookup']. Trả về (status, value)."""
    if not cfg.get("turn_lookup"):
        return "ok", None
    t = render(cfg["turn_lookup"], {**cfg.get("vars", {})})
    r = None
    for _ in range(retries):
        try:
            r = session.get(t["url"], headers=t.get("headers", {}), timeout=cfg.get("timeout", 10))
            break
        except requests.RequestException as e:
            log.warning("Lấy TurnID lỗi mạng (%s), thử lại...", type(e).__name__)
            time.sleep(2)
    if r is None:
        return "error", None
    if r.status_code in (401, 403):
        return "auth", None
    try:
        turn_id = r.json()[t.get("field", "IdDot")]
        cfg.setdefault("vars", {})["turn_id"] = turn_id
        return "ok", turn_id
    except Exception:
        return "error", None


def render(obj, ctx):
    if isinstance(obj, str) and obj == "@item":
        return obj
    """Thay {placeholder} (course_id, class_id, ...) và ${ENV} trong str/dict/list."""
    if isinstance(obj, str):
        for k, v in ctx.items():
            obj = obj.replace("{" + k + "}", str(v))
        return os.path.expandvars(obj)
    if isinstance(obj, dict):
        return {k: render(v, ctx) for k, v in obj.items()}
    if isinstance(obj, list):
        return [render(v, ctx) for v in obj]
    return obj


def wait_until(open_time):
    if not open_time:
        return
    target = datetime.fromisoformat(str(open_time))
    while True:
        left = (target - datetime.now()).total_seconds()
        if left <= 0:
            return
        log.info("Chờ đến %s (còn %.0fs)", target, left)
        time.sleep(min(left, 30) if left > 1 else 0.05)


def try_register(session, cfg, ctx, dry_run):
    item = ctx.get("_item")
    req = render(cfg["request"], {k: v for k, v in ctx.items() if k != "_item"})
    if dry_run:
        log.info("[dry-run] %s %s body=%s", req["method"], req["url"], req.get("body"))
        return "success"
    body = req.get("body")
    if body == "@item":  # gửi nguyên object lớp lấy từ danh sách (UI gửi [object])
        if "_item" not in ctx:
            return "retry"
        body = [ctx["_item"]]
    kwargs = {"headers": req.get("headers", {}), "timeout": cfg.get("timeout", 10)}
    if req.get("body_type", "json") == "json":
        kwargs["json"] = body
    else:
        kwargs["data"] = body
    r = session.request(req["method"], req["url"], **kwargs)
    text = r.text
    log.debug("HTTP %s: %s", r.status_code, text[:300])
    if r.status_code in (401, 403):
        return "auth"
    if any(s in text for s in cfg.get("full_contains", [])):
        return "full"
    if r.ok:  # HTTP 2xx và không báo đầy => coi là thành công, dừng để không đăng ký thêm lớp khác
        log.info("Phản hồi máy chủ: %s", text[:200])
        return "success"
    if r.status_code >= 500 or r.status_code == 429:
        return "retry"
    return "fail:" + text[:200]


def has_slot(session, cfg, ctx):
    """Canh chỗ trống qua `watch`: gọi API danh sách lớp, đọc số chỗ còn lại của lớp."""
    w = cfg.get("watch")
    if not w:
        return True
    req = render(w["request"], {k: v for k, v in ctx.items() if k != "_item"})
    try:
        kw = {"headers": req.get("headers", {}), "timeout": cfg.get("timeout", 10)}
        if req.get("body") is not None:
            kw["json"] = req["body"]
        r = session.request(req.get("method", "GET"), req["url"], **kw)
        for it in r.json():
            if it.get(w["id_field"]) == ctx["class_id"]:
                ctx["_item"] = it
                return int(it.get(w["slots_field"]) or 0) > 0
        return False
    except Exception as e:  # lỗi mạng/parse: cứ thử đăng ký
        log.debug("watch lỗi: %s", e)
        return True


def fetch_items(session, cfg, ctx):
    """Gọi API danh sách lớp 1 lần, trả dict {id: item}; None nếu lỗi."""
    w = cfg["watch"]
    req = render(w["request"], {k: v for k, v in ctx.items() if k != "_item"})
    try:
        kw = {"headers": req.get("headers", {}), "timeout": cfg.get("timeout", 10)}
        if req.get("body") is not None:
            kw["json"] = req["body"]
        r = session.request(req.get("method", "GET"), req["url"], **kw)
        if r.status_code in (401, 403):
            return "auth"
        return {it[w["id_field"]]: it for it in r.json()}
    except Exception as e:
        log.debug("watch lỗi: %s", e)
        return None


def ask_new_token():
    """Token hết hạn: báo bíp và chờ bạn dán token mới (không thoát tool)."""
    print("\a")
    log.error("🔑 TOKEN HẾT HẠN! Đăng nhập lại trên web, lấy token mới (Local Storage > authorizationData > Token).")
    while True:
        t = input("Dán token mới rồi nhấn Enter: ").strip().strip('"')
        if t.lower().startswith("bearer "):
            t = t[7:]
        if t.count(".") == 2:
            os.environ["TOKEN"] = t
            log.info("Đã cập nhật token, tiếp tục canh...")
            return
        print("Token không đúng định dạng (phải có 2 dấu chấm). Thử lại.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="config.yaml")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--course", help="mã môn (vd MMC407); bỏ trống để nhập khi chạy")
    ap.add_argument("--classes", help="chỉ canh các lớp này, vd 01,05,09; bỏ trống = tất cả")
    a = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s",
                        handlers=[logging.StreamHandler(), logging.FileHandler("register.log", encoding="utf-8")])
    load_env()
    cfg = yaml.safe_load(open(a.config, encoding="utf-8"))
    session = make_session()
    if cfg.get("turn_lookup"):  # tự lấy TurnID (IdDot) từ API
        status, turn_id = fetch_turn_id(session, cfg)
        if status == "error":
            log.error("Không lấy được TurnID.")
            return
        if status == "auth":
            log.error("Token hết hạn/không hợp lệ. Cập nhật .env.")
            return
        log.info("TurnID = %s", turn_id)
    if a.course is not None or cfg.get("ask_course", True):
        code = (a.course or input("Nhập mã môn (vd MMC407): ")).strip().upper()
        prefix = str(cfg.get("term_prefix", "262"))
        course_id = code if code.startswith(prefix) else prefix + code
        picked = a.classes
        if picked is None and a.course is None:
            picked = input("Chỉ canh các lớp nào? (vd 01,05,09; Enter = tất cả): ").strip()
        base = {"course_id": course_id, **cfg.get("vars", {}), "class_id": ""}
        items = fetch_items(session, cfg, base)
        if not isinstance(items, dict) or not items:
            log.error("❌ Không lấy được danh sách lớp của %s (sai mã môn hoặc token hết hạn).", course_id)
            return
        ids = sorted(items)
        if picked:
            want = [x.strip() for x in picked.split(",") if x.strip()]
            ids = [i for i in ids if any(i.endswith(w.zfill(2)) for w in want)]
            ids.sort(key=lambda i: [w.zfill(2) for w in want].index(next(w.zfill(2) for w in want if i.endswith(w.zfill(2)))))
        if not ids:
            log.error("❌ Không có lớp nào khớp.")
            return
        cfg["courses"] = [{"course_id": course_id, "candidates": [{"class_id": i} for i in ids]}]
        log.info("Môn %s - canh %d lớp: %s", course_id, len(ids), ", ".join(i[-2:] for i in ids))
    wait_until(cfg.get("open_time"))

    pending = list(cfg["courses"])
    interval = cfg.get("interval", 1.0)
    max_rounds = cfg.get("max_rounds", 200)  # đặt 100000 để canh nhiều giờ
    slots_field = cfg.get("watch", {}).get("slots_field", "NumberRegistOfEmpty")
    last_beat = 0
    mode = "[THỬ - dry-run] " if a.dry_run else ""
    for rnd in range(1, max_rounds + 1):
        if not pending:
            break
        status = []
        for course in list(pending):
            base = {"course_id": course["course_id"], **cfg.get("vars", {})}
            items = fetch_items(session, cfg, {**base, "class_id": ""}) if cfg.get("watch") else {}
            if items == "auth":
                ask_new_token()
                continue
            if items is None:
                log.warning("⚠️ Lỗi mạng khi lấy danh sách lớp, thử lại...")
                time.sleep(interval)
                continue
            for cand in course["candidates"]:  # theo thứ tự ưu tiên
                ctx = {**base, **cand}
                item = items.get(cand["class_id"]) if cfg.get("watch") else None
                if item is not None:
                    ctx["_item"] = item
                n = (item or {}).get(slots_field, "?")
                status.append(f"{cand['class_id'][-2:]}: {n}")
                if cfg.get("watch") and int(n or 0) <= 0:
                    continue
                log.info("🔔 %sCÓ CHỖ TRỐNG ở %s (%s chỗ) -> đang đăng ký...", mode, cand["class_id"], n)
                try:
                    res = try_register(session, cfg, ctx, a.dry_run)
                except requests.RequestException as e:
                    log.warning("⚠️ Lỗi mạng khi đăng ký: %s", type(e).__name__)
                    res = "retry"
                if res == "success":
                    log.info("✅ %sĐĂNG KÝ THÀNH CÔNG: %s", mode, cand["class_id"])
                    pending.remove(course)
                    break
                if res == "auth":
                    ask_new_token()
                    break
                if res == "full":
                    log.info("⏳ %s vừa đầy (có người nhanh hơn), thử lớp khác...", cand["class_id"])
                elif res == "retry":
                    log.info("🔁 Server bận, thử lại...")
                    break
                else:
                    log.info("❌ %s bị từ chối: %s", cand["class_id"], res)
        if time.time() - last_beat >= 10 and pending:
            log.info("👀 ĐANG CANH (số chỗ từng lớp) | %s", " | ".join(status))
            last_beat = time.time()
        time.sleep(interval)
    if pending:
        log.info("Hết số vòng, chưa đăng ký được: %s", [c["course_id"] for c in pending])
    else:
        log.info("🎉 Hoàn tất: đã đăng ký xong tất cả môn.")


if __name__ == "__main__":
    main()
