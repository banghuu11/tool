function formatCountdown(sec) {
  if (!sec || sec <= 0) return 'Hết hạn';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export default function HeaderBar({ school = 'vhu', status, soundOn, onToggleSound, onOpenLogin }) {
  const schoolLabel = school.toUpperCase();
  const user = status?.user;
  const rem = status?.remaining_seconds ?? 0;
  const valid = status?.token_valid;
  const tokenTone = !valid ? 'red' : rem < 900 ? 'amber' : 'green';

  return (
    <header className="card header">
      <div className="brand">
        <h1>{schoolLabel} Auto-Register</h1>
        <p>
          {user?.name ? `${user.name} (${user.id})` : 'Chưa đăng nhập tài khoản sinh viên'}
          {status?.turn_id ? ` • Đợt: ${status.turn_id}` : ''}
        </p>
      </div>

      <div className="header-right">
        <span className={`badge ${tokenTone}`}>
          {valid ? `Token còn ${formatCountdown(rem)}` : 'Token hết hạn / Chưa có'}
        </span>
        <button className="btn-secondary" onClick={onToggleSound} title="Bật/tắt âm thanh thông báo">
          {soundOn ? '🔔 Âm thanh: Bật' : '🔕 Âm thanh: Tắt'}
        </button>
        <button className="btn-primary" onClick={onOpenLogin}>
          {valid ? 'Đổi tài khoản / Token' : `Đăng nhập ${schoolLabel}`}
        </button>
      </div>
    </header>
  );
}
