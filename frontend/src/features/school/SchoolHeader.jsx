import { ArrowLeft, KeyRound, Volume2, VolumeX } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatCountdown(sec) {
  if (!sec || sec <= 0) return 'Hết hạn';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function SchoolHeader({
  school,
  status,
  soundOn,
  onToggleSound,
  onOpenLogin,
  onBackHome,
}) {
  const schoolLabel = school.toUpperCase();
  const user = status?.user;
  const rem = status?.remaining_seconds ?? 0;
  const valid = status?.token_valid;
  const badgeVariant = !valid ? 'destructive' : rem < 900 ? 'warning' : 'success';

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        {onBackHome && (
          <Button variant="outline" size="sm" onClick={onBackHome} title="Quay lại chọn trường">
            <ArrowLeft className="h-4 w-4" />
            Trang chủ
          </Button>
        )}
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {schoolLabel} Auto-Register
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {user?.name ? `${user.name} (${user.id})` : 'Chưa đăng nhập tài khoản sinh viên'}
            {status?.turn_id ? ` • Đợt: ${status.turn_id}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Badge variant={badgeVariant}>
          {valid ? `Token còn ${formatCountdown(rem)}` : 'Token hết hạn / Chưa có'}
        </Badge>
        <Button variant="outline" size="sm" onClick={onToggleSound}>
          {soundOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          {soundOn ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}
        </Button>
        <Button size="sm" onClick={onOpenLogin}>
          <KeyRound className="h-4 w-4" />
          {valid ? 'Đổi tài khoản / Token' : `Đăng nhập ${schoolLabel}`}
        </Button>
      </div>
    </Card>
  );
}
