import { Building2, GraduationCap, Home, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SCHOOLS = [
  { id: 'vhu', label: 'VHU', sub: 'ĐH Văn Hiến', icon: GraduationCap, badge: 'Sẵn sàng' },
  { id: 'huflit', label: 'HUFLIT', sub: 'ĐH Ngoại ngữ - Tin học', icon: Building2, badge: 'Sẵn sàng' },
];

export function Sidebar({ activePage, onSelect }) {
  return (
    <aside className="lg:sticky lg:top-5">
      <Card className="flex flex-col gap-4 p-4">
        <button
          type="button"
          onClick={() => onSelect('home')}
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary cursor-pointer"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">Auto-Register</div>
            <div className="truncate text-xs text-muted-foreground">Cổng đăng ký học phần</div>
          </div>
        </button>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onSelect('home')}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors cursor-pointer',
              activePage === 'home'
                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                : 'border-border bg-secondary/60 text-foreground hover:bg-secondary'
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div>Trang chủ</div>
              <div
                className={cn(
                  'text-[11px] font-medium',
                  activePage === 'home' ? 'text-blue-100' : 'text-muted-foreground'
                )}
              >
                Tổng quan & Chọn trường
              </div>
            </div>
          </button>
        </div>

        <div className="space-y-2">
          <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Danh sách trường
          </div>

          <div className="space-y-1.5">
            {SCHOOLS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-secondary/60 text-foreground hover:bg-secondary'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.label}</div>
                      <div
                        className={cn(
                          'truncate text-[11px]',
                          isActive ? 'text-blue-100' : 'text-muted-foreground'
                        )}
                      >
                        {item.sub}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={isActive ? 'default' : 'success'}
                    className={cn(
                      'shrink-0 px-2 py-0 text-[10px]',
                      isActive && 'bg-white/20 text-white border-transparent'
                    )}
                  >
                    {item.badge}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>Mỗi trường chạy độc lập: Token, cấu hình API và nhật ký tách biệt hoàn toàn.</span>
        </div>
      </Card>
    </aside>
  );
}
