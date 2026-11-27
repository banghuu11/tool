import { useState } from 'react';
import { Play, Square, Trash2, X } from 'lucide-react';
import { clearFinishedJobs, startWatchJob, stopWatchJob } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS_META = {
  running: { label: 'Đang canh', variant: 'info' },
  waiting_token: { label: 'Chờ Token mới', variant: 'warning' },
  success: { label: 'Thành công', variant: 'success' },
  stopped: { label: 'Đã dừng', variant: 'destructive' },
};

export function WatcherPanel({
  school,
  queuedItems,
  onRemoveQueued,
  onClearQueued,
  jobs,
  onRefresh,
}) {
  const [intervalSec, setIntervalSec] = useState(1.0);
  const [dryRun, setDryRun] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function handleStartAll() {
    if (queuedItems.length === 0) return;
    setError('');
    setStarting(true);
    try {
      const errs = [];
      for (const item of queuedItems) {
        const data = await startWatchJob(school, {
          course_id: item.course_id,
          study_type: item.study_type,
          class_ids: item.class_ids,
          interval: Number(intervalSec) || 1.0,
          dry_run: dryRun,
        });
        if (!data.ok) {
          errs.push(`${item.course_id}: ${data.error || 'Không thể bắt đầu canh.'}`);
        }
      }
      if (errs.length > 0) {
        setError(errs.join(' | '));
      } else {
        onClearQueued();
      }
      onRefresh();
    } catch {
      setError('Lỗi kết nối server cục bộ.');
    } finally {
      setStarting(false);
    }
  }

  async function handleStop(jobId) {
    await stopWatchJob(school, jobId);
    onRefresh();
  }

  async function handleClearFinished() {
    await clearFinishedJobs(school);
    onRefresh();
  }

  const hasFinished = jobs.some((j) => j.status === 'stopped' || j.status === 'success');
  const totalQueuedClasses = queuedItems.reduce((sum, q) => sum + q.class_ids.length, 0);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>
          2. Hàng chờ & Các môn đang canh ({queuedItems.length + jobs.length})
        </CardTitle>
        {hasFinished && (
          <Button variant="outline" size="sm" onClick={handleClearFinished}>
            <Trash2 className="h-3.5 w-3.5" />
            Dọn đã xong
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Phần Hàng chờ (Chưa chạy) */}
        {queuedItems.length > 0 && (
          <div className="space-y-2.5 rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  Danh sách chờ ({queuedItems.length} môn • {totalQueuedClasses} lớp)
                </span>
                <Badge variant="warning">Chưa chạy</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearQueued}>
                Xoá hàng chờ
              </Button>
            </div>

            <div className="space-y-2">
              {queuedItems.map((item) => (
                <div
                  key={`${item.course_id}:${item.study_type}`}
                  className="rounded-lg border border-border bg-card p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <strong className="text-foreground">{item.course_id}</strong>{' '}
                      <span className="text-muted-foreground">({item.study_type})</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onRemoveQueued(item.course_id)}
                      title="Bỏ khỏi hàng chờ"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.class_ids.map((cid) => (
                      <span
                        key={cid}
                        className="rounded-md border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-foreground"
                      >
                        {cid.slice(-2)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-200/70 pt-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <label className="flex items-center gap-1.5">
                  <span>Nghỉ (giây):</span>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.4"
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(e.target.value)}
                    className="h-8 w-16 px-2 text-xs"
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-foreground">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>Chạy thử (Dry-run)</span>
                </label>
              </div>
              <Button variant="success" size="sm" disabled={starting} onClick={handleStartAll}>
                <Play className="h-3.5 w-3.5" />
                {starting ? 'Đang khởi chạy...' : `Bắt đầu canh (${queuedItems.length} môn)`}
              </Button>
            </div>
          </div>
        )}

        {/* Phần Đang canh / Đã xong */}
        {jobs.length === 0 && queuedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Chưa có môn nào trong hàng chờ hoặc đang canh. Hãy tìm môn ở trên, tick lớp rồi bấm{' '}
            <strong className="text-foreground">Đưa vào hàng chờ</strong>.
          </p>
        ) : (
          <div className="space-y-2.5">
            {jobs.map((job) => {
              const meta = STATUS_META[job.status] || { label: job.status, variant: 'secondary' };
              const active = job.status === 'running' || job.status === 'waiting_token';
              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-border bg-secondary/50 p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <strong className="text-foreground">{job.course_id}</strong>{' '}
                      <span className="text-xs text-muted-foreground">
                        ({job.study_type}) • Vòng {job.rounds} {job.dry_run ? '• DRY-RUN' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {active && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => handleStop(job.id)}
                        >
                          <Square className="h-3 w-3" />
                          Dừng
                        </Button>
                      )}
                    </div>
                  </div>

                  {job.result && (
                    <div className="mt-2 text-xs font-semibold text-emerald-700">
                      ✅ Đã đăng ký lớp: {job.result}
                    </div>
                  )}

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {job.class_ids.map((cid) => {
                      const n = job.slots?.[cid] ?? '?';
                      const isOpen = Number(n) > 0;
                      return (
                        <span
                          key={cid}
                          className={cn(
                            'rounded-md border px-2 py-0.5 font-mono text-xs',
                            isOpen
                              ? 'border-emerald-500 bg-emerald-50 font-bold text-emerald-700'
                              : 'border-border bg-card text-foreground'
                          )}
                        >
                          {cid.slice(-2)}: {n}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
