import { useState } from 'react';

export default function LoginModal({ school = 'vhu', isOpen, canClose, onClose, onSuccess }) {
  const schoolLabel = school.toUpperCase();
  const [tab, setTab] = useState(school === 'huflit' ? 'token' : 'account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phonenumber, setPhonenumber] = useState('');
  const [needPhone, setNeedPhone] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school, username, password, phonenumber }),
      });
      const data = await res.json();
      if (!data.ok) {
        const msg = data.error || 'Đăng nhập thất bại.';
        if (msg.toLowerCase().includes('phonenumber')) {
          setNeedPhone(true);
          setError('Hệ thống yêu cầu nhập Số điện thoại để đăng nhập.');
        } else {
          setError(msg);
        }
      } else {
        setPassword('');
        setPhonenumber('');
        setNeedPhone(false);
        onSuccess(data.data);
      }
    } catch {
      setError('Không kết nối được tới server cục bộ.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveToken(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school, token }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Token không hợp lệ.');
      } else {
        setToken('');
        onSuccess(data.data);
      }
    } catch {
      setError('Không kết nối được tới server cục bộ.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="section-title">
          <span>Đăng nhập Cổng sinh viên {schoolLabel}</span>
          {canClose && (
            <button className="btn-secondary" onClick={onClose} style={{ padding: '4px 10px' }}>
              ✕
            </button>
          )}
        </div>

        <div className="tabs">
          <button
            className={tab === 'account' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setTab('account'); setError(''); }}
          >
            Tài khoản {schoolLabel}
          </button>
          <button
            className={tab === 'token' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => { setTab('token'); setError(''); }}
          >
            Dán Token thủ công
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {tab === 'account' ? (
          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Mã số sinh viên (MSSV)</label>
              <input
                type="text"
                placeholder="VD: 241A211088"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label>Mật khẩu</label>
              <input
                type="password"
                placeholder="Nhập mật khẩu cổng đăng ký"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {needPhone && (
              <div className="field">
                <label>Số điện thoại</label>
                <input
                  type="tel"
                  placeholder="VD: 0901234567"
                  value={phonenumber}
                  onChange={(e) => setPhonenumber(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 0 }}>
              Mật khẩu không được lưu lại; chỉ lưu Token phiên làm việc vào file .env.
            </p>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập & Lấy Token'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSaveToken}>
            <div className="field">
              <label>JWT Token (từ Local Storage &gt; authorizationData &gt; Token)</label>
              <textarea
                rows={4}
                placeholder="eyJhbGciOi..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Đang lưu...' : 'Lưu Token'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
