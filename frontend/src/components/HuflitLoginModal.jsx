import { useMemo, useState } from 'react';

function previewJwt(raw) {
  const clean = (raw || '').trim().replace(/^"+|"+$/g, '').replace(/^bearer\s+/i, '').trim();
  if (!clean) return null;
  const parts = clean.split('.');
  if (parts.length !== 3) return { invalid: 'Chuỗi chưa đúng định dạng JWT (phải gồm 3 phần cách nhau bằng dấu chấm, bắt đầu bằng eyJ...).' };
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const data = JSON.parse(json);
    if (!data.Id && !data.Name) {
      return { invalid: 'JWT không chứa thông tin sinh viên hợp lệ.' };
    }
    const expired = data.exp ? data.exp * 1000 <= Date.now() : false;
    return {
      id: data.Id || '',
      name: data.Name || '',
      program: data.StudyProgramIds || '',
      aud: data.aud || '',
      expired,
    };
  } catch {
    return { invalid: 'Không giải mã được JWT. Hãy kiểm tra lại chuỗi Token đã copy.' };
  }
}

export default function HuflitLoginModal({ isOpen, canClose = true, onClose, onSuccess }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const info = useMemo(() => previewJwt(token), [token]);

  if (!isOpen) return null;

  async function handleSaveToken(e) {
    e.preventDefault();
    setError('');
    if (!info || info.invalid) {
      setError(info?.invalid || 'Vui lòng dán JWT Token của HUFLIT.');
      return;
    }
    if (info.expired) {
      setError('Token này đã hết hạn. Hãy tải lại trang dkmh.huflit.edu.vn để lấy Token mới.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school: 'huflit', token }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Token HUFLIT không hợp lệ.');
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
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="section-title">
          <span>Đăng nhập Cổng sinh viên HUFLIT</span>
          {canClose && (
            <button className="btn-secondary" onClick={onClose} style={{ padding: '4px 10px' }}>
              ✕
            </button>
          )}
        </div>

        <div className="watcher-item" style={{ marginBottom: 14, fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            Hướng dẫn lấy Token HUFLIT (3 bước):
          </div>
          <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--muted)', display: 'grid', gap: 4 }}>
            <li>
              Đăng nhập trên{' '}
              <a href="https://dkmh.huflit.edu.vn/student" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                dkmh.huflit.edu.vn/student
              </a>
            </li>
            <li>
              Mở <strong>DevTools (Cmd+Option+I)</strong> → <strong>Application → Local Storage</strong> → tìm mục{' '}
              <code>authorizationData</code> (hoặc tab <strong>Network</strong> → header <code>authorization</code>).
            </li>
            <li>
              Copy chuỗi <strong>Token</strong> bắt đầu bằng <code>eyJ...</code> (có thể kèm chữ <code>Bearer</code>) rồi dán vào ô dưới.
            </li>
          </ol>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSaveToken}>
          <div className="field">
            <label>JWT Token HUFLIT</label>
            <textarea
              rows={5}
              placeholder="Bearer eyJhbGciOiJIUzI1NiIs..."
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError('');
              }}
              required
              autoFocus
            />
          </div>

          {info && !info.invalid && (
            <div
              className={`badge ${info.expired ? 'red' : 'green'}`}
              style={{ marginBottom: 12, width: '100%', justifyContent: 'flex-start', borderRadius: 8, padding: '8px 10px' }}
            >
              {info.expired
                ? `⚠️ Token đã hết hạn — ${info.name} (${info.id})`
                : `✓ ${info.name} (${info.id})${info.program ? ` • ${info.program}` : ''}`}
            </div>
          )}

          {info?.invalid && token.trim().length > 0 && (
            <div className="error-msg" style={{ fontSize: '0.8rem' }}>
              {info.invalid}
            </div>
          )}

          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 0 }}>
            Token được lưu riêng vào biến <code>HUFLIT_TOKEN</code> trong file <code>.env</code> trên máy của bạn.
          </p>

          <button
            className="btn-primary"
            type="submit"
            disabled={loading || Boolean(info?.invalid) || Boolean(info?.expired)}
            style={{ width: '100%' }}
          >
            {loading ? 'Đang lưu Token...' : 'Xác nhận & Lưu Token HUFLIT'}
          </button>
        </form>
      </div>
    </div>
  );
}
