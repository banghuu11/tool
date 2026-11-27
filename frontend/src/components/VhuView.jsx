import { useCallback, useEffect, useRef, useState } from 'react';
import HeaderBar from './HeaderBar.jsx';
import LoginModal from './LoginModal.jsx';
import CourseLookup from './CourseLookup.jsx';
import WatcherList from './WatcherList.jsx';
import LogPanel from './LogPanel.jsx';

export default function VhuView({ soundOn, onToggleSound, onBeep }) {
  const [status, setStatus] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const seenEvents = useRef(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status?school=vhu');
      const data = await res.json();
      setStatus(data);

      if (soundOn && Array.isArray(data.logs)) {
        for (const l of data.logs.slice(-10)) {
          if (!seenEvents.current.has(l.id)) {
            seenEvents.current.add(l.id);
            if (l.level === 'success' && l.job_id) onBeep(1046, 0.35);
            if (l.level === 'auth') onBeep(440, 0.4);
          }
        }
      }
    } catch {
      // ignore transient poll error
    }
  }, [soundOn, onBeep]);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 1000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  return (
    <>
      <HeaderBar
        school="vhu"
        status={status}
        soundOn={soundOn}
        onToggleSound={onToggleSound}
        onOpenLogin={() => setShowLogin(true)}
      />

      <CourseLookup school="vhu" onJobStarted={fetchStatus} />

      <div className="grid-bottom">
        <WatcherList school="vhu" jobs={status?.jobs || []} onRefresh={fetchStatus} />
        <LogPanel logs={status?.logs || []} />
      </div>

      <LoginModal
        school="vhu"
        isOpen={showLogin}
        canClose
        onClose={() => setShowLogin(false)}
        onSuccess={(newStatus) => {
          setStatus(newStatus);
          setShowLogin(false);
        }}
      />
    </>
  );
}
