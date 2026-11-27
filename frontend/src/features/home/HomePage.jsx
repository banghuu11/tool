import { ArrowRight, BellRing, Layers, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const SCHOOLS = [
  {
    id: 'vhu',
    code: 'VHU',
    name: 'Trường Đại học Văn Hiến',
    status: 'Đang hoạt động',
    desc: 'Đăng nhập cổng sinh viên VHU, tra cứu lớp học phần, thêm vào hàng chờ và bắt đầu canh nhiều môn song song.',
    cta: 'Vào cổng VHU',
  },
  {
    id: 'huflit',
    code: 'HUFLIT',
    name: 'Trường Đại học Ngoại ngữ - Tin học TP.HCM',
    status: 'Đang hoạt động',
    desc: 'Kết nối cổng đăng ký tín chỉ HUFLIT bằng JWT Token, tra cứu lớp học phần, xếp hàng chờ và canh slot tự động.',
    cta: 'Vào cổng HUFLIT',
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
    title: 'Xếp hàng chờ → Bắt đầu canh',
    desc: 'Chọn sẵn các lớp của từng môn vào danh sách chờ rồi bấm Bắt đầu canh đồng loạt ở bước cuối.',
  },
];

export function HomePage({ onSelectSchool }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-4">
          <div>
            <Badge variant="info" className="mb-3">
              Hệ thống hỗ trợ đăng ký học phần cục bộ
            </Badge>
            <CardTitle className="text-xl sm:text-2xl">Chọn cổng trường để bắt đầu</CardTitle>
            <CardDescription className="mt-1.5">
              Chọn trường ở thanh điều hướng bên trái hoặc chọn trực tiếp bên dưới. Mỗi cổng trường hoạt động hoàn toàn độc lập.
            </CardDescription>
          </div>
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
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
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

      <div className="grid gap-5 md:grid-cols-2">
        {SCHOOLS.map((school) => (
          <Card key={school.id} className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold tracking-wider text-primary">{school.code}</div>
                  <CardTitle className="mt-1 text-lg">{school.name}</CardTitle>
                </div>
                <Badge variant="success" className="shrink-0">
                  {school.status}
                </Badge>
              </div>
              <CardDescription className="pt-2 leading-relaxed">{school.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => onSelectSchool(school.id)}>
                {school.cta}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
