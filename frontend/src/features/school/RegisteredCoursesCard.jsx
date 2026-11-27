import { BookCheck, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export function RegisteredCoursesCard({ portal, loading, onRefresh, tokenValid }) {
  const registered = portal?.registered || [];
  const quota = portal?.quota;
  const programs = portal?.programs || [];
  const totalCredits = registered.reduce((sum, r) => sum + Number(r.Credits || 0), 0);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookCheck className="h-4 w-4 text-primary" />
            <span>Các môn đã đăng ký ({registered.length})</span>
          </CardTitle>
          <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
            <span>Tổng tín chỉ: <strong className="text-foreground">{totalCredits}</strong></span>
            {quota && (
              <>
                <span>•</span>
                <span>
                  Hạn mức: {quota.MainTermMinCredits ?? 0}–{quota.MainTermMaxCredits ?? '?'} TC
                </span>
                {quota.YearStudy && quota.TermID && (
                  <>
                    <span>•</span>
                    <span>
                      {quota.YearStudy} ({quota.TermID})
                    </span>
                  </>
                )}
              </>
            )}
            {programs.length > 0 && (
              <>
                <span>•</span>
                <span>{programs[0].StudyProgramName || programs[0].StudyProgramID}</span>
              </>
            )}
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
          {quota && (
            <Badge variant={quota.RegistAble ? 'success' : 'warning'}>
              {quota.RegistAble ? 'Đang mở đăng ký' : quota.RegistAbleDescr || 'Chưa mở đăng ký'}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!tokenValid || loading}
            onClick={() => onRefresh()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Đang tải...' : 'Tải lại'}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {!tokenValid ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-5 text-center text-sm text-muted-foreground">
            Đăng nhập để tải danh sách các môn đã đăng ký từ cổng trường.
          </div>
        ) : registered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-secondary/40 p-5 text-center text-sm text-muted-foreground">
            {loading
              ? 'Đang đồng bộ dữ liệu từ cổng trường...'
              : portal?.errors?.registered
                ? `Không tải được danh sách: ${portal.errors.registered}`
                : 'Chưa có môn học nào được đăng ký trong đợt này.'}
          </div>
        ) : (
          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <Table className="border-0">
              <TableHeader>
                <TableRow className="hover:bg-secondary">
                  <TableHead>Mã lớp</TableHead>
                  <TableHead>Tên môn học</TableHead>
                  <TableHead className="w-16 text-center">TC</TableHead>
                  <TableHead>Lịch học</TableHead>
                  <TableHead>Giảng viên</TableHead>
                  <TableHead className="w-28 text-center">Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registered.map((row) => (
                  <TableRow key={row.ScheduleStudyUnitID || row.ScheduleStudyUnitAlias}>
                    <TableCell>
                      <div className="font-semibold text-foreground">
                        {row.ScheduleStudyUnitAlias || row.ScheduleStudyUnitID}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{row.CurriculumID}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.CurriculumName}</div>
                      {row.BeginDate && row.EndDate && (
                        <div className="text-[11px] text-muted-foreground">
                          {row.BeginDate} – {row.EndDate}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {Number(row.Credits || 0)}
                    </TableCell>
                    <TableCell
                      className="text-xs leading-relaxed text-slate-700"
                      dangerouslySetInnerHTML={{ __html: row.Schedules || '' }}
                    />
                    <TableCell className="text-xs text-slate-700">
                      {(row.ProfessorName || '').trim()}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.TrungLich ? (
                        <Badge variant="destructive">Trùng lịch</Badge>
                      ) : (
                        <Badge variant="success">Đã đăng ký</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
