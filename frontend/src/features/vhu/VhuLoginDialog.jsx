import { useState } from 'react';
import { loginAccount, saveSchoolToken } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';

export function VhuLoginDialog({ open, loginBlocked = false, loginBlockReason = '', onClose, onSuccess }) {
  const [tab, setTab] = useState('account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phonenumber, setPhonenumber] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockedLocal, setBlockedLocal] = useState(false);
  const [error, setError] = useState('');

  const isBlocked = loginBlocked || blockedLocal;

  async function handleLogin(e) {
    e.preventDefault();
    if (loading || isBlocked) return;
    setError('');
    setLoading(true);
    try {
      const data = await loginAccount('vhu', { username, password, phonenumber });
      if (!data.ok) {
        setBlockedLocal(true);
        setPassword('');
        setError(
          data.error ||
            'Đăng nhập thất bại. Đã dừng hẳn để tránh spam/khóa tài khoản — không thử lại.'
        );
      } else {
        setPassword('');
        setPhonenumber('');
        setBlockedLocal(false);
        onSuccess(data.data);
      }
    } catch {
      setBlockedLocal(true);
      setError('Không kết nối được tới server cục bộ. Đã dừng đăng nhập để tránh gửi lặp.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveToken(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const data = await saveSchoolToken('vhu', token);
      if (!data.ok) {
        setError(data.error || 'Token không hợp lệ.');
      } else {
        setToken('');
        setBlockedLocal(false);
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
      title="Đăng nhập Cổng sinh viên VHU"
      description="Mật khẩu không được lưu lại; chỉ lưu Token phiên làm việc vào file .env."
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button
          variant={tab === 'account' ? 'default' : 'outline'}
          onClick={() => {
            setTab('account');
            setError('');
          }}
        >
          Tài khoản VHU
        </Button>
        <Button
          variant={tab === 'token' ? 'default' : 'outline'}
          onClick={() => {
            setTab('token');
            setError('');
          }}
        >
          Dán Token thủ công
        </Button>
      </div>

      {tab === 'account' && isBlocked && (
        <div className="mb-3 space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <div className="font-semibold">⚠️ Đã dừng đăng nhập để chống spam / khóa tài khoản</div>
          <div>
            {error ||
              (loginBlockReason
                ? `Lần thử trước thất bại: ${loginBlockReason}.`
                : 'Lần đăng nhập trước không thành công.')}{' '}
            Tool sẽ không thử lại bằng mật khẩu.
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 bg-white text-xs"
            onClick={() => {
              setTab('token');
              setError('');
            }}
          >
            Chuyển sang Dán Token thủ công
          </Button>
        </div>
      )}

      {error && !(tab === 'account' && isBlocked) && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {tab === 'account' ? (
        <form onSubmit={handleLogin} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Mã số sinh viên (MSSV)
            </label>
            <Input
              type="text"
              placeholder="VD: 241A211088"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || isBlocked}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mật khẩu</label>
            <Input
              type="password"
              placeholder="Nhập mật khẩu cổng đăng ký"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || isBlocked}
              required
            />
          </div>

          <Button type="submit" disabled={loading || isBlocked} className="w-full">
            {loading
              ? 'Đang đăng nhập...'
              : isBlocked
                ? 'Đã dừng đăng nhập (không thử lại)'
                : 'Đăng nhập & Lấy Token'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleSaveToken} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              JWT Token (Local Storage &gt; authorizationData &gt; Token)
            </label>
            <Textarea
              rows={4}
              placeholder="eyJhbGciOi..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Đang lưu...' : 'Lưu Token VHU'}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
