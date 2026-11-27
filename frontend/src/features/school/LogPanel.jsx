import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const LEVEL_CLASS = {
  success: 'text-emerald-700 font-medium',
  slot: 'text-amber-700 font-semibold',
  error: 'text-red-700',
  auth: 'text-red-700 font-medium',
  warn: 'text-orange-700',
  info: 'text-slate-700',
};

export function LogPanel({ logs }) {
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>3. Nhật ký hoạt động (Realtime)</CardTitle>
        <span className="text-xs text-muted-foreground">{logs.length} dòng</span>
      </CardHeader>
      <CardContent>
        <div
          ref={boxRef}
          className="h-64 overflow-y-auto rounded-lg border border-border bg-slate-50 p-3 font-mono text-xs leading-relaxed"
        >
          {logs.length === 0 ? (
            <div className="text-muted-foreground">Chưa có sự kiện nào...</div>
          ) : (
            logs.map((l) => (
              <div key={l.id} className={cn('break-words py-0.5', LEVEL_CLASS[l.level] || 'text-slate-700')}>
                <span className="text-muted-foreground">[{l.time}]</span> {l.message}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
