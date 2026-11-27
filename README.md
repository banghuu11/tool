# VHU auto-register

## Chạy bằng giao diện Web (React JS)

```bash
cd /Users/Huflit/NATRIO-FOOD/vhu-register
source .venv/bin/activate
python web_ui.py
```

Mở trình duyệt tại `http://127.0.0.1:8765`:
- Đăng nhập trực tiếp bằng MSSV & mật khẩu (hoặc dán Token thủ công).
- Tìm mã môn (VD: `MMC407`, `MMC406`), chọn loại hình (`KH`, `NKH`, `HL`, `CT`, `HV`), tick các lớp muốn canh rồi bấm **Bắt đầu canh**.
- Hỗ trợ canh nhiều môn song song và xem log realtime.

*(Nếu chỉnh sửa code React trong `frontend/`, chạy `npm run build` trong `frontend/` hoặc `npm run dev` trên cổng `5173`.)*

---

## Chạy bằng dòng lệnh (CLI)

1. `pip install -r requirements.txt`
2. `cp config.example.yaml config.yaml` và `cp .env.example .env`
3. Điền `TOKEN`/`COOKIE` vào `.env` (không commit file này).
4. Test: `python register.py --config config.mmc407.yaml --dry-run`
5. Chạy thật: `python register.py --config config.mmc407.yaml`

Không vượt CAPTCHA; token hết hạn thì đăng nhập lại để cập nhật `.env`.
