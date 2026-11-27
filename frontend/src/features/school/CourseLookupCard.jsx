import { useMemo, useState } from 'react';
import { BookOpen, ListPlus, Plus, Search, X } from 'lucide-react';
import { getAllowRegistClasses, lookupCourse } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

let nextRowId = 1;
function makeRow(code = '', studyType = 'KH') {
  return { id: nextRowId++, code, studyType };
}

function parseCourseCodes(raw) {
  return (raw || '')
    .split(/[,\s;]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function CourseLookupCard({ school, portal, onAddToQueue }) {
  const studyTypes = useMemo(() => {
    const raw = portal?.study_types;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((st) => ({
        value: st.LoaiHinh,
        label: `${st.LoaiHinh} - ${st.TenChucNang}`,
      }));
    }
    return [{ value: portal?.active_study_type || 'KH', label: portal?.active_study_type || 'KH' }];
  }, [portal?.study_types, portal?.active_study_type]);

  const [rows, setRows] = useState(() => [makeRow('', 'KH')]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [results, setResults] = useState([]);
  const [activeCourseId, setActiveCourseId] = useState('');
  const [selectedByCourse, setSelectedByCourse] = useState({});
  const [showAllowList, setShowAllowList] = useState(false);
  const [allowList, setAllowList] = useState(null);
  const [allowLoading, setAllowLoading] = useState(false);

  const displayedAllowList = allowList ?? (portal?.allow_regist || []);

  async function handleToggleAllowList() {
    const next = !showAllowList;
    setShowAllowList(next);
    if (next && displayedAllowList.length === 0) {
      setAllowLoading(true);
      try {
        const st = rows[0]?.studyType || portal?.active_study_type || 'KH';
        const res = await getAllowRegistClasses(school, {
          study_type: st,
          program_id: portal?.program_id,
          year_study: portal?.quota?.YearStudy,
          term_id: portal?.quota?.TermID,
        });
        if (res.ok) setAllowList(res.data?.rows || []);
      } finally {
        setAllowLoading(false);
      }
    }
  }

  function pickAllowedCourse(code) {
    if (!code) return;
    setRows((prev) => {
      if (prev.some((r) => r.code.trim().toUpperCase() === code.toUpperCase())) return prev;
      const emptyIdx = prev.findIndex((r) => !r.code.trim());
      if (emptyIdx >= 0) {
        return prev.map((r, i) => (i === emptyIdx ? { ...r, code } : r));
      }
      return [...prev, makeRow(code, prev[prev.length - 1]?.studyType || 'KH')];
    });
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow('', prev[prev.length - 1]?.studyType || 'KH')]);
  }

  function removeRow(id) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateRow(id, patch) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleLookup(e) {
    e.preventDefault();
    const pairs = [];
    const seen = new Set();
    for (const row of rows) {
      for (const code of parseCourseCodes(row.code)) {
        const key = `${code}::${row.studyType}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ code, studyType: row.studyType });
        }
      }
    }

    if (pairs.length === 0) {
      setError('Vui lòng nhập ít nhất 1 mã môn.');
      return;
    }

    setError('');
    setNotice('');
    setLoading(true);
    try {
      const settled = await Promise.all(
        pairs.map(async ({ code, studyType }) => {
          try {
            const data = await lookupCourse(school, { course_id: code, study_type: studyType });
            if (!data.ok) {
              return { ok: false, code, error: data.error || `Không tìm thấy môn ${code}.` };
            }
            return { ok: true, code, data: data.data };
          } catch {
            return { ok: false, code, error: `Lỗi kết nối khi tìm môn ${code}.` };
          }
        })
      );

      const found = [];
      const errs = [];
      for (const item of settled) {
        if (item.ok) found.push(item.data);
        else errs.push(`${item.code}: ${item.error}`);
      }

      if (errs.length > 0) setError(errs.join(' | '));

      if (found.length > 0) {
        const prevIds = new Set(results.map((r) => r.course_id));
        const newest = found.find((r) => !prevIds.has(r.course_id));
        setResults(found);
        setActiveCourseId((cur) => {
          if (newest) return newest.course_id;
          if (found.some((r) => r.course_id === cur)) return cur;
          return found[0].course_id;
        });
        setSelectedByCourse((prev) => {
          const next = {};
          for (const r of found) {
            const validIds = new Set(r.classes.map((c) => c.CurriculumID));
            // Mặc định không chọn sẵn lớp nào cho môn mới
            next[r.course_id] = (prev[r.course_id] || []).filter((cid) => validIds.has(cid));
          }
          return next;
        });
      } else {
        setResults([]);
        setActiveCourseId('');
        setSelectedByCourse({});
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleClass(courseId, classId) {
    setSelectedByCourse((prev) => {
      const cur = prev[courseId] || [];
      const next = cur.includes(classId) ? cur.filter((x) => x !== classId) : [...cur, classId];
      return { ...prev, [courseId]: next };
    });
  }

  function toggleAllForCourse(course) {
    const allIds = course.classes.map((c) => c.CurriculumID);
    setSelectedByCourse((prev) => {
      const cur = prev[course.course_id] || [];
      return { ...prev, [course.course_id]: cur.length === allIds.length ? [] : allIds };
    });
  }

  function removeCourseResult(courseId) {
    setResults((prev) => {
      const next = prev.filter((r) => r.course_id !== courseId);
      if (activeCourseId === courseId) setActiveCourseId(next[0]?.course_id || '');
      return next;
    });
    setSelectedByCourse((prev) => {
      const next = { ...prev };
      delete next[courseId];
      return next;
    });
  }

  const activeCourse = results.find((r) => r.course_id === activeCourseId) || results[0] || null;
  const selectedCourses = results
    .map((r) => ({
      course_id: r.course_id,
      study_type: r.study_type,
      class_ids: selectedByCourse[r.course_id] || [],
    }))
    .filter((r) => r.class_ids.length > 0);

  const totalSelectedClasses = selectedCourses.reduce((sum, r) => sum + r.class_ids.length, 0);

  function handleStageToQueue() {
    if (selectedCourses.length === 0) return;
    onAddToQueue(selectedCourses);
    setNotice(
      `Đã đưa ${selectedCourses.length} môn (${totalSelectedClasses} lớp) vào hàng chờ bên dưới. Bấm "Bắt đầu canh" ở Mục 2 khi sẵn sàng.`
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle>1. Tìm môn & Chọn lớp muốn canh</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToggleAllowList}>
            <BookOpen className="h-3.5 w-3.5" />
            Môn được phép ĐK ({displayedAllowList.length})
          </Button>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />
            Thêm môn
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {showAllowList && (
          <div className="rounded-xl border border-border bg-secondary/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground">
                Chọn nhanh môn được phép đăng ký từ cổng trường (bấm để điền mã môn):
              </span>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowAllowList(false)}>
                Đóng
              </Button>
            </div>
            {allowLoading ? (
              <div className="text-xs text-muted-foreground">Đang tải danh sách môn...</div>
            ) : displayedAllowList.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Chưa có danh sách môn được phép đăng ký (kiểm tra đăng nhập hoặc đợt đăng ký).
              </div>
            ) : (
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                {displayedAllowList.map((m, i) => {
                  const code = m.CurriculumID || m.StudyUnitID || m.MaMonHoc || '';
                  const name = m.CurriculumName || m.StudyUnitName || m.TenMonHoc || '';
                  if (!code) return null;
                  return (
                    <button
                      key={`${code}-${i}`}
                      type="button"
                      onClick={() => pickAllowedCourse(code)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:bg-blue-50 cursor-pointer"
                      title={name}
                    >
                      <strong className="text-primary">{code}</strong>
                      {name && <span className="max-w-[180px] truncate text-muted-foreground">{name}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLookup} className="space-y-2">
          {rows.map((row, idx) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2">
              <Input
                value={row.code}
                onChange={(e) => updateRow(row.id, { code: e.target.value })}
                placeholder={`Nhập mã môn ${rows.length > 1 ? `#${idx + 1}` : ''}`}
                className="min-w-[200px] flex-1"
              />
              <Select
                value={row.studyType}
                onChange={(e) => updateRow(row.id, { studyType: e.target.value })}
              >
                {studyTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              {idx === rows.length - 1 && (
                <Button variant="outline" size="icon" onClick={addRow} title="Thêm môn khác">
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {rows.length > 1 && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  title="Xoá dòng này"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {idx === rows.length - 1 && (
                <Button type="submit" disabled={loading} className="min-w-[116px]">
                  <Search className="h-4 w-4" />
                  {loading ? 'Đang tải...' : 'Tìm lớp'}
                </Button>
              )}
            </div>
          ))}
        </form>

        <div className="flex h-[390px] flex-col">
          {error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              {notice}
            </div>
          )}

          {results.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
              {loading
                ? 'Đang tải danh sách lớp học phần...'
                : 'Nhập mã môn (bấm dấu + để thêm nhiều môn) rồi bấm "Tìm lớp" để xem danh sách lớp.'}
            </div>
          ) : (
            <>
              <div className="mb-2.5 flex flex-wrap gap-2">
                {results.map((course) => {
                  const selCount = (selectedByCourse[course.course_id] || []).length;
                  const isActive = activeCourse?.course_id === course.course_id;
                  return (
                    <button
                      key={course.course_id}
                      type="button"
                      onClick={() => setActiveCourseId(course.course_id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary text-foreground hover:bg-slate-200/80'
                      )}
                    >
                      <span>{course.course_id}</span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-900/10 text-foreground'
                        )}
                      >
                        {selCount}/{course.classes.length}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeCourse && (() => {
                const selected = selectedByCourse[activeCourse.course_id] || [];
                const allSelected =
                  selected.length === activeCourse.classes.length && activeCourse.classes.length > 0;
                return (
                  <>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Môn <strong className="text-foreground">{activeCourse.course_id}</strong> ({activeCourse.study_type} •{' '}
                        {activeCourse.classes.length} lớp) • Đã chọn{' '}
                        <strong className="text-primary">{selected.length}</strong> lớp
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAllForCourse(activeCourse)}
                        >
                          {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </Button>
                        {results.length > 1 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeCourseResult(activeCourse.course_id)}
                            title="Ẩn môn này khỏi danh sách"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div
                      className={cn(
                        'min-h-0 flex-1 overflow-auto rounded-lg border border-border transition-opacity',
                        loading && 'opacity-60'
                      )}
                    >
                      <Table className="border-0">
                        <TableHeader>
                          <TableRow className="hover:bg-secondary">
                            <TableHead className="w-10" />
                            <TableHead>Mã lớp</TableHead>
                            <TableHead>Lịch học</TableHead>
                            <TableHead>Giảng viên</TableHead>
                            <TableHead className="w-20 text-center">Trống</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeCourse.classes.map((c) => {
                            const empty = Number(c.NumberRegistOfEmpty || 0);
                            const checked = selected.includes(c.CurriculumID);
                            return (
                              <TableRow
                                key={c.CurriculumID}
                                onClick={() => toggleClass(activeCourse.course_id, c.CurriculumID)}
                                className={cn('cursor-pointer', checked && 'bg-blue-50/60 hover:bg-blue-50')}
                              >
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {}}
                                    className="h-4 w-4 rounded border-input accent-primary"
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="font-semibold text-foreground">
                                    {c.ScheduleStudyUnitAlias || c.CurriculumID}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    Sĩ số: {c.NumberOfStudents}
                                  </div>
                                </TableCell>
                                <TableCell
                                  className="text-xs leading-relaxed text-slate-700"
                                  dangerouslySetInnerHTML={{ __html: c.Schedules || '' }}
                                />
                                <TableCell className="text-xs text-slate-700">
                                  {(c.ProfessorName || '').trim()}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={empty > 0 ? 'success' : 'secondary'}>{empty}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                );
              })()}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  Bước 1: Chọn lớp rồi đưa vào hàng chờ. Bước 2: Bấm <strong>Bắt đầu canh</strong> ở mục bên dưới.
                </span>
                <Button
                  variant="default"
                  disabled={totalSelectedClasses === 0}
                  onClick={handleStageToQueue}
                >
                  <ListPlus className="h-4 w-4" />
                  Đưa vào hàng chờ ({selectedCourses.length} môn • {totalSelectedClasses} lớp)
                </Button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
