import { useState } from 'react';

const STUDY_TYPES = [
  { value: 'KH', label: 'KH - Tiến độ chuẩn' },
  { value: 'NKH', label: 'NKH - Ngoài kế hoạch' },
  { value: 'HL', label: 'HL - Học lại' },
  { value: 'CT', label: 'CT - Cải thiện' },
  { value: 'HV', label: 'HV - Học vượt' },
];

export default function CourseLookup({ school = 'vhu', onJobStarted }) {
  const [courseInput, setCourseInput] = useState(school === 'vhu' ? 'MMC407' : '');
  const [studyType, setStudyType] = useState('KH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState([]);
  const [intervalSec, setIntervalSec] = useState(1.0);
  const [dryRun, setDryRun] = useState(false);

  async function handleLookup(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school, course_id: courseInput, study_type: studyType }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Không tìm thấy môn học.');
        setResult(null);
      } else {
        setResult(data.data);
        setSelected(data.data.classes.map((c) => c.CurriculumID));
      }
    } catch {
      setError('Lỗi kết nối server cục bộ.');
    } finally {
      setLoading(false);
    }
  }

  function toggleClass(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleStart() {
    if (!result || selected.length === 0) return;
    setError('');
    const res = await fetch('/api/jobs/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school,
        course_id: result.course_id,
        study_type: result.study_type,
        class_ids: selected,
        interval: Number(intervalSec) || 1.0,
        dry_run: dryRun,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error || 'Không thể bắt đầu canh.');
    } else {
      onJobStarted();
    }
  }

  return (
    <section className="card">
      <div className="section-title">
        <span>1. Tìm môn & Chọn lớp muốn canh</span>
      </div>

      <form className="row" onSubmit={handleLookup}>
        <input
          type="text"
          value={courseInput}
          onChange={(e) => setCourseInput(e.target.value)}
          placeholder={school === 'vhu' ? 'Mã môn (VD: MMC407)' : 'Nhập mã môn HUFLIT'}
          style={{ width: 150 }}
        />
        <select value={studyType} onChange={(e) => setStudyType(e.target.value)}>
          {STUDY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button className="btn-primary" type="submit" disabled={loading} style={{ minWidth: 112 }}>
          {loading ? 'Đang tải...' : 'Tìm lớp'}
        </button>
      </form>

      <div className="lookup-body">
        {error && <div className="error-msg" style={{ marginBottom: 8 }}>{error}</div>}

        {!result ? (
          <div className="lookup-empty">
            {loading
              ? 'Đang tải danh sách lớp học phần...'
              : 'Nhập mã môn học ở trên và bấm "Tìm lớp" để xem danh sách lớp.'}
          </div>
        ) : (
          <>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.86rem', color: 'var(--muted)' }}>
                Môn <strong>{result.course_id}</strong> ({result.classes.length} lớp) • Đã chọn{' '}
                <strong>{selected.length}</strong> lớp
              </span>
              <div className="row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    setSelected(
                      selected.length === result.classes.length
                        ? []
                        : result.classes.map((c) => c.CurriculumID)
                    )
                  }
                >
                  {selected.length === result.classes.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>
            </div>

            <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 34 }}></th>
                    <th>Mã lớp</th>
                    <th>Lịch học</th>
                    <th>Giảng viên</th>
                    <th>Trống</th>
                  </tr>
                </thead>
                <tbody>
                  {result.classes.map((c) => {
                    const empty = Number(c.NumberRegistOfEmpty || 0);
                    const checked = selected.includes(c.CurriculumID);
                    return (
                      <tr key={c.CurriculumID} onClick={() => toggleClass(c.CurriculumID)} style={{ cursor: 'pointer' }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                          />
                        </td>
                        <td>
                          <strong>{c.ScheduleStudyUnitAlias || c.CurriculumID}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                            Sĩ số: {c.NumberOfStudents}
                          </div>
                        </td>
                        <td dangerouslySetInnerHTML={{ __html: c.Schedules || '' }} />
                        <td>{(c.ProfessorName || '').trim()}</td>
                        <td>
                          <span className={`badge ${empty > 0 ? 'green' : ''}`}>
                            {empty}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
              <div className="row">
                <label style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                  Nghỉ giữa vòng (giây):
                  <input
                    type="number"
                    step="0.1"
                    min="0.4"
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(e.target.value)}
                    style={{ width: 76, marginLeft: 8 }}
                  />
                </label>
                <label className="row" style={{ fontSize: '0.84rem', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                  />
                  Chạy thử (Dry-run)
                </label>
              </div>
              <button
                className="btn-success"
                type="button"
                disabled={selected.length === 0}
                onClick={handleStart}
              >
                ▶ Bắt đầu canh ({selected.length} lớp)
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
