async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function getSchoolStatus(school) {
  const res = await fetch(`/api/status?school=${encodeURIComponent(school)}`);
  return res.json();
}

export function loginAccount(school, { username, password, phonenumber = '' }) {
  return postJson('/api/login', { school, username, password, phonenumber });
}

export function startBrowserLogin(school, { username = '', password = '' } = {}) {
  return postJson('/api/login/browser', { school, username, password });
}

export function saveSchoolToken(school, token) {
  return postJson('/api/token', { school, token });
}

export function lookupCourse(school, { course_id, study_type }) {
  return postJson('/api/lookup', { school, course_id, study_type });
}

export function startWatchJob(school, { course_id, study_type, class_ids, interval, dry_run }) {
  return postJson('/api/jobs/start', {
    school,
    course_id,
    study_type,
    class_ids,
    interval,
    dry_run,
  });
}

export function stopWatchJob(school, job_id) {
  return postJson('/api/jobs/stop', { school, job_id });
}

export function clearFinishedJobs(school) {
  return postJson('/api/jobs/clear', { school });
}

export async function getPortalOverview(school, { study_type, program_id } = {}) {
  const params = new URLSearchParams({ school });
  if (study_type) params.set('study_type', study_type);
  if (program_id) params.set('program_id', program_id);
  const res = await fetch(`/api/portal/overview?${params.toString()}`);
  return res.json();
}

export async function getRegisteredClasses(school, { turn_id, program_id } = {}) {
  const params = new URLSearchParams({ school });
  if (turn_id != null) params.set('turn_id', String(turn_id));
  if (program_id) params.set('program_id', program_id);
  const res = await fetch(`/api/portal/registered?${params.toString()}`);
  return res.json();
}

export function getAllowRegistClasses(school, { study_type, program_id, year_study, term_id, keyword = '' }) {
  return postJson('/api/portal/allow-regist', {
    school,
    study_type,
    program_id,
    year_study,
    term_id,
    keyword,
  });
}

export function playBeep(freq = 880, duration = 0.25) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // ignore browser autoplay block
  }
}
