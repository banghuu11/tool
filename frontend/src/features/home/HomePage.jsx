import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Building2,
  GraduationCap,
  Layers,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const UNIVERSITIES = [
  {
    id: 'vhu',
    code: 'VHU',
    name: 'Trường Đại học Văn Hiến',
    portal: 'regist.vhu.edu.vn',
    active: true,
    status: 'Đang hoạt động',
    desc: 'Hỗ trợ đăng nhập tài khoản VHU (tự hiện SĐT nếu yêu cầu) hoặc dán Token, tìm nhiều môn, xếp hàng chờ và canh slot tự động.',
    cta: 'Vào cổng VHU',
  },
  {
    id: 'huflit',
    code: 'HUFLIT',
    name: 'Trường Đại học Ngoại ngữ - Tin học TP.HCM',
    portal: 'dkmh.huflit.edu.vn',
    active: true,
    status: 'Đang hoạt động',
    desc: 'Kết nối cổng đăng ký tín chỉ HUFLIT bằng JWT Token, kiểm tra trước hạn Token, xếp hàng chờ và canh slot độc lập.',
    cta: 'Vào cổng HUFLIT',
  },
  {
    id: 'hutech',
    code: 'HUTECH',
    name: 'Trường Đại học Công nghệ TP.HCM',
    portal: 'dkmh.hutech.edu.vn',
    active: false,
    status: 'Sắp hỗ trợ',
    desc: 'Đang lên kế hoạch tích hợp cấu hình API cổng đăng ký học phần HUTECH.',
    cta: 'Sắp ra mắt',
  },
  {
    id: 'vlu',
    code: 'VLU',
    name: 'Trường Đại học Văn Lang',
    portal: 'online.vlu.edu.vn',
    active: false,
    status: 'Sắp hỗ trợ',
    desc: 'Đang lên kế hoạch tích hợp cấu hình API cổng đăng ký học phần Văn Lang.',
    cta: 'Sắp ra mắt',
  },
];

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: 'Lưu cục bộ & An toàn',
    desc: 'Mật khẩu không được lưu lại; chỉ lưu Token phiên vào file .env ngay trên máy của bạn.',
  },
  {
    icon: Layers,
    title: 'Độc lập theo từng trường',
    desc: 'Mỗi trường có API, Token, danh sách hàng chờ, job canh và nhật ký hoạt động riêng biệt.',
  },
  {
    icon: BellRing,
    title: 'Hàng chờ → Bắt đầu canh',
    desc: 'Chọn sẵn các lớp của nhiều môn vào hàng chờ rồi bấm Bắt đầu canh đồng loạt ở bước cuối.',
  },
];

export function HomePage({ onSelectSchool }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return UNIVERSITIES.filter((u) => {
      if (filter === 'active' && !u.active) return false;
      if (filter === 'soon' && u.active) return false;
      if (!q) return true;
      return (
        u.code.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.portal.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  const activeCount = UNIVERSITIES.filter((u) => u.active).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="info">Cổng tổng hợp các trường đại học</Badge>
            <Badge variant="success">{activeCount} trường đang hoạt động</Badge>
          </div>
          <CardTitle className="pt-2 text-xl sm:text-2xl">
            Chọn trường đại học để bắt đầu
          </CardTitle>
          <CardDescription className="mt-1">
            Mỗi trường hoạt động hoàn toàn độc lập về Token, cấu hình API, hàng chờ và nhật ký.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-secondary/50 p-4"
                >
                  <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon className="h-4 w-4 text-primary" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Danh sách trường đại học ({filtered.length})</CardTitle>
            <CardDescription className="mt-1">
              Tìm theo mã trường, tên trường hoặc tên miền cổng đăng ký.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm VHU, HUFLIT..."
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                Tất cả
              </Button>
              <Button
                variant={filter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('active')}
              >
                Đang hoạt động
              </Button>
              <Button
                variant={filter === 'soon' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('soon')}
              >
                Sắp hỗ trợ
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-8 text-center text-sm text-muted-foreground">
              Không tìm thấy trường phù hợp với từ khoá "{query}".
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((school) => {
                const Icon = school.active ? GraduationCap : Building2;
                return (
                  <div
                    key={school.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold tracking-wider text-primary">
                              {school.code}
                            </div>
                            <h4 className="text-base font-bold text-foreground">{school.name}</h4>
                          </div>
                        </div>
                        <Badge variant={school.active ? 'success' : 'warning'} className="shrink-0">
                          {school.status}
                        </Badge>
                      </div>

                      <div className="mt-2 font-mono text-xs text-muted-foreground">
                        {school.portal}
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                        {school.desc}
                      </p>
                    </div>

                    <div className="mt-4">
                      <Button
                        variant={school.active ? 'default' : 'outline'}
                        size="sm"
                        disabled={!school.active}
                        onClick={() => school.active && onSelectSchool(school.id)}
                      >
                        {school.cta}
                        {school.active && <ArrowRight className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
