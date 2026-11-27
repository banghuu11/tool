import { useEffect, useRef } from 'react';

export default function LogPanel({ logs }) {
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <section className="card">
      <div className="section-title">
        <span>3. Nhật ký hoạt động (Realtime)</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{logs.length} dòng</span>
      </div>
      <div className="log-box" ref={boxRef}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--muted)' }}>Chưa có sự kiện nào...</div>
        ) : (
          logs.map((l) => (
            <div key={l.id} className={`log-line log-${l.level}`}>
              <span style={{ color: 'var(--muted)' }}>[{l.time}]</span> {l.message}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
