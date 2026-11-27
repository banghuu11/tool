const STATUS_META = {
  running: { label: 'Đang canh', cls: 'blue' },
  waiting_token: { label: 'Chờ Token mới', cls: 'amber' },
  success: { label: 'Thành công', cls: 'green' },
  stopped: { label: 'Đã dừng', cls: 'red' },
};

export default function WatcherList({ school = 'vhu', jobs, onRefresh }) {
  async function handleStop(jobId) {
    await fetch('/api/jobs/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school, job_id: jobId }),
    });
    onRefresh();
  }

  async function handleClear() {
    await fetch('/api/jobs/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school }),
    });
    onRefresh();
  }

  const hasFinished = jobs.some((j) => j.status === 'stopped' || j.status === 'success');

  return (
    <section className="card">
      <div className="section-title">
        <span>2. Các môn đang canh ({jobs.length})</span>
        {hasFinished && (
          <button className="btn-secondary" onClick={handleClear} style={{ padding: '5px 10px', fontSize: '0.78rem' }}>
            Dọn đã xong
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
          Chưa có môn nào đang canh. Hãy tìm môn ở trên và bấm <strong>Bắt đầu canh</strong>.
        </p>
      ) : (
        <div className="watcher-list">
          {jobs.map((job) => {
            const meta = STATUS_META[job.status] || { label: job.status, cls: '' };
            const active = job.status === 'running' || job.status === 'waiting_token';
            return (
              <div className="watcher-item" key={job.id}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{job.course_id}</strong>{' '}
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      ({job.study_type}) • Vòng {job.rounds} {job.dry_run ? '• DRY-RUN' : ''}
                    </span>
                  </div>
                  <div className="row">
                    <span className={`badge ${meta.cls}`}>{meta.label}</span>
                    {active && (
                      <button
                        className="btn-danger"
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => handleStop(job.id)}
                      >
                        Dừng
                      </button>
                    )}
                  </div>
                </div>

                {job.result && (
                  <div style={{ marginTop: 8, color: '#047857', fontSize: '0.85rem', fontWeight: 600 }}>
                    ✅ Đã đăng ký lớp: {job.result}
                  </div>
                )}

                <div className="slots-grid">
                  {job.class_ids.map((cid) => {
                    const n = job.slots?.[cid] ?? '?';
                    const isOpen = Number(n) > 0;
                    return (
                      <span key={cid} className={`slot-pill ${isOpen ? 'open' : ''}`}>
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
    </section>
  );
}
