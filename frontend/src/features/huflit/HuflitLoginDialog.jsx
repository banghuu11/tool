import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, KeyRound, Loader2 } from 'lucide-react';
import { saveSchoolToken, startBrowserLogin } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Textarea } from '@/components/ui/input';

function previewJwt(raw) {
  const clean = (raw || '').trim().replace(/^"+|"+$/g, '').replace(/^bearer\s+/i, '').trim();
  if (!clean) return null;
  const parts = clean.split('.');
  if (parts.length !== 3) {
    return {
      invalid:
        'Chuỗi chưa đúng định dạng JWT (phải gồm 3 phần cách nhau bằng dấu chấm, bắt đầu bằng eyJ...).',
    };
  }
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
      expired,
    };
  } catch {
    return { invalid: 'Không giải mã được JWT. Hãy kiểm tra lại chuỗi Token đã copy.' };
  }
}

export function HuflitLoginDialog({ open, status, onStatusUpdate, onClose, onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [launchingBrowser, setLaunchingBrowser] = useState(false);
  const [error, setError] = useState('');
  const wasBrowserActive = useRef(false);

  const info = useMemo(() => previewJwt(token), [token]);
  const browserActive = Boolean(status?.browser_login_active);

  useEffect(() => {
    if (!open) {
      wasBrowserActive.current = false;
      return;
    }
    if (browserActive) {
      wasBrowserActive.current = true;
      return;
    }
    if (wasBrowserActive.current && !browserActive) {
      wasBrowserActive.current = false;
      if (status?.browser_login_error) {
        setError(status.browser_login_error);
      } else if (status?.token_valid) {
        setError('');
        onSuccess(status);
      }
    }
  }, [open, browserActive, status, onSuccess]);

  async function handleOpenBrowserLogin(e) {
    e.preventDefault();
    if (launchingBrowser || browserActive) return;
    setError('');
    setLaunchingBrowser(true);
    try {
      const data = await startBrowserLogin('huflit', { username, password });
      setPassword('');
      if (!data.ok) {
        setError(data.error || 'Không mở được trình duyệt đăng nhập HUFLIT.');
      } else {
        wasBrowserActive.current = true;
        if (data.data && onStatusUpdate) onStatusUpdate(data.data);
      }
    } catch {
      setError('Không kết nối được tới server cục bộ.');
    } finally {
      setLaunchingBrowser(false);
    }
  }

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
      const data = await saveSchoolToken('huflit', token);
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Đăng nhập Cổng sinh viên HUFLIT"
      description="Token được lưu riêng vào biến HUFLIT_TOKEN trong file .env cục bộ."
      className="max-w-lg"
    >
      <form onSubmit={handleOpenBrowserLogin} className="mb-4 space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
        <div className="text-xs font-bold text-foreground">
          Cách 1 (Khuyên dùng): Đăng nhập tài khoản HUFLIT
        </div>
        <p className="text-xs text-muted-foreground">
          Nhập tài khoản Office 365 HUFLIT — tool sẽ tự động đăng nhập ngầm, bắt &amp; lưu Token
          cục bộ. (Mật khẩu không lưu lại.)
        </p>
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Email sinh viên (VD: 23dh112530@st.huflit.edu.vn)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={launchingBrowser || browserActive || loading}
            required
            autoFocus
          />
          <Input
            type="password"
            placeholder="Mật khẩu Office 365"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={launchingBrowser || browserActive || loading}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={launchingBrowser || browserActive || loading}
          className="w-full"
        >
          {launchingBrowser || browserActive ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang đăng nhập...
            </>
          ) : (
            <>
              <KeyRound className="h-4 w-4" />
              Đăng nhập
            </>
          )}
        </Button>
      </form>

      <div className="mb-4 rounded-xl border border-border bg-secondary/60 p-3.5 text-xs">
        <div className="mb-1.5 font-bold text-foreground">
          Cách 2: Dán Token thủ công (nếu không dùng trình duyệt)
        </div>
        <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>
            Đăng nhập trên{' '}
            <a
              href="https://dkmh.huflit.edu.vn/student"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              dkmh.huflit.edu.vn/student
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li>
            Mở <strong className="text-foreground">DevTools (Cmd+Option+I)</strong> →{' '}
            <strong className="text-foreground">Application → Local Storage</strong> → tìm{' '}
            <code className="rounded bg-slate-200/70 px-1">authorizationData</code> (hoặc tab{' '}
            <strong className="text-foreground">Network</strong> → header{' '}
            <code className="rounded bg-slate-200/70 px-1">authorization</code>).
          </li>
          <li>
            Copy chuỗi <strong className="text-foreground">Token</strong> bắt đầu bằng{' '}
            <code className="rounded bg-slate-200/70 px-1">eyJ...</code> rồi dán vào ô dưới.
          </li>
        </ol>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveToken} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">JWT Token HUFLIT</label>
          <Textarea
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
          <Badge
            variant={info.expired ? 'destructive' : 'success'}
            className="w-full justify-start rounded-lg px-3 py-2 text-xs"
          >
            {info.expired
              ? `⚠️ Token đã hết hạn — ${info.name} (${info.id})`
              : `✓ ${info.name} (${info.id})${info.program ? ` • ${info.program}` : ''}`}
          </Badge>
        )}

        {info?.invalid && token.trim().length > 0 && (
          <p className="text-xs font-medium text-red-700">{info.invalid}</p>
        )}

        <Button
          type="submit"
          disabled={loading || Boolean(info?.invalid) || Boolean(info?.expired)}
          className="w-full"
        >
          {loading ? 'Đang lưu Token...' : 'Xác nhận & Lưu Token HUFLIT'}
        </Button>
      </form>
    </Dialog>
  );
}
