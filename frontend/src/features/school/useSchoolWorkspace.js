import { useCallback, useEffect, useRef, useState } from 'react';
import { getSchoolStatus, playBeep } from '@/lib/api';

export function useSchoolWorkspace(school, soundOn) {
  const [status, setStatus] = useState(null);
  const [queuedItems, setQueuedItems] = useState([]);
  const seenEvents = useRef(new Set());

  const refresh = useCallback(async () => {
    try {
      const data = await getSchoolStatus(school);
      setStatus(data);

      if (soundOn && Array.isArray(data.logs)) {
        for (const l of data.logs.slice(-10)) {
          if (!seenEvents.current.has(l.id)) {
            seenEvents.current.add(l.id);
            if (l.level === 'success' && l.job_id) playBeep(1046, 0.35);
            if (l.level === 'auth') playBeep(440, 0.4);
          }
        }
      }
    } catch {
      // ignore transient poll error
    }
  }, [school, soundOn]);

  const shouldPoll =
    school !== 'huflit' ||
    Boolean(status?.browser_login_active) ||
    Boolean(status?.jobs?.some((j) => j.status === 'running' || j.status === 'waiting_token'));

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!shouldPoll) return undefined;
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [refresh, shouldPoll]);

  const addToQueue = useCallback((items) => {
    setQueuedItems((prev) => {
      const map = new Map(prev.map((x) => [x.course_id, x]));
      for (const item of items) {
        map.set(item.course_id, item);
      }
      return Array.from(map.values());
    });
  }, []);

  const removeQueued = useCallback((courseId) => {
    setQueuedItems((prev) => prev.filter((x) => x.course_id !== courseId));
  }, []);

  const clearQueued = useCallback(() => setQueuedItems([]), []);

  return {
    status,
    setStatus,
    refresh,
    queuedItems,
    addToQueue,
    removeQueued,
    clearQueued,
  };
}
