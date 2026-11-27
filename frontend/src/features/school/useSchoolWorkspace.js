import { useCallback, useEffect, useRef, useState } from 'react';
import { getPortalOverview, getSchoolStatus, playBeep } from '@/lib/api';

export function useSchoolWorkspace(school, soundOn) {
  const [status, setStatus] = useState(null);
  const [portal, setPortal] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [queuedItems, setQueuedItems] = useState([]);
  const seenEvents = useRef(new Set());
  const loadedTokenRef = useRef(false);

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

  const refreshPortal = useCallback(
    async (opts = {}) => {
      setPortalLoading(true);
      try {
        const res = await getPortalOverview(school, opts);
        if (res.ok) {
          setPortal(res.data);
        }
      } catch {
        // ignore transient error
      } finally {
        setPortalLoading(false);
      }
    },
    [school]
  );

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (status?.token_valid && !loadedTokenRef.current) {
      loadedTokenRef.current = true;
      refreshPortal();
    } else if (!status?.token_valid) {
      loadedTokenRef.current = false;
    }
  }, [status?.token_valid, refreshPortal]);

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
    portal,
    portalLoading,
    refreshPortal,
    queuedItems,
    addToQueue,
    removeQueued,
    clearQueued,
  };
}
