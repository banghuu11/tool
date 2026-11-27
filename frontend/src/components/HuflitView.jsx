import { useCallback, useEffect, useRef, useState } from 'react';
import HeaderBar from './HeaderBar.jsx';
import HuflitLoginModal from './HuflitLoginModal.jsx';
import CourseLookup from './CourseLookup.jsx';
import WatcherList from './WatcherList.jsx';
import LogPanel from './LogPanel.jsx';

export default function HuflitView({ soundOn, onToggleSound, onBeep }) {
  const [status, setStatus] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const seenEvents = useRef(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status?school=huflit');
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

  const backendOutdated = Boolean(status && status.school !== 'huflit');

  return (
    <>
      {backendOutdated && (
        <div className="card" style={{ borderColor: 'var(--red)', color: '#b91c1c', fontWeight: 600 }}>
          ⚠️ Server <code>web_ui.py</code> đang chạy bản cũ nên chưa tách riêng VHU và HUFLIT. Hãy nhấn <code>Ctrl+C</code> trong terminal và chạy lại <code>.venv/bin/python web_ui.py</code>.
        </div>
      )}

      <HeaderBar
        school="huflit"
        status={status}
        soundOn={soundOn}
        onToggleSound={onToggleSound}
        onOpenLogin={() => setShowLogin(true)}
      />

      <CourseLookup school="huflit" onJobStarted={fetchStatus} />

      <div className="grid-bottom">
        <WatcherList school="huflit" jobs={status?.jobs || []} onRefresh={fetchStatus} />
        <LogPanel logs={status?.logs || []} />
      </div>

      <HuflitLoginModal
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
