import { useState } from 'react';
import { loginAccount, saveSchoolToken } from '@/lib/api';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';

export function VhuLoginDialog({ open, onClose, onSuccess }) {
  const [tab, setTab] = useState('account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phonenumber, setPhonenumber] = useState('');
  const [needPhone, setNeedPhone] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginAccount('vhu', { username, password, phonenumber });
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
      const data = await saveSchoolToken('vhu', token);
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

      {error && (
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
              required
            />
          </div>

          {needPhone && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Số điện thoại</label>
              <Input
                type="tel"
                placeholder="VD: 0901234567"
                value={phonenumber}
                onChange={(e) => setPhonenumber(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập & Lấy Token'}
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
