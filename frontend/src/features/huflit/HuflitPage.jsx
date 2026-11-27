import { useState } from 'react';
import { useSchoolWorkspace } from '@/features/school/useSchoolWorkspace';
import { SchoolHeader } from '@/features/school/SchoolHeader';
import { CourseLookupCard } from '@/features/school/CourseLookupCard';
import { WatcherPanel } from '@/features/school/WatcherPanel';
import { LogPanel } from '@/features/school/LogPanel';
import { HuflitLoginDialog } from './HuflitLoginDialog';

export function HuflitPage({ soundOn, onToggleSound, onBackHome }) {
  const [showLogin, setShowLogin] = useState(false);
  const { status, setStatus, refresh, queuedItems, addToQueue, removeQueued, clearQueued } =
    useSchoolWorkspace('huflit', soundOn);

  const backendOutdated = Boolean(status && status.school !== 'huflit');

  return (
    <div className="space-y-5">
      {backendOutdated && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          ⚠️ Server <code>web_ui.py</code> đang chạy bản cũ nên chưa tách riêng VHU và HUFLIT. Hãy nhấn{' '}
          <code>Ctrl+C</code> trong terminal và chạy lại <code>.venv/bin/python web_ui.py</code>.
        </div>
      )}

      <SchoolHeader
        school="huflit"
        status={status}
        soundOn={soundOn}
        onToggleSound={onToggleSound}
        onOpenLogin={() => setShowLogin(true)}
        onBackHome={onBackHome}
      />

      <CourseLookupCard school="huflit" onAddToQueue={addToQueue} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <WatcherPanel
          school="huflit"
          queuedItems={queuedItems}
          onRemoveQueued={removeQueued}
          onClearQueued={clearQueued}
          jobs={status?.jobs || []}
          onRefresh={refresh}
        />
        <LogPanel logs={status?.logs || []} />
      </div>

      <HuflitLoginDialog
        open={showLogin}
        status={status}
        onStatusUpdate={setStatus}
        onClose={() => setShowLogin(false)}
        onSuccess={(newStatus) => {
          setStatus(newStatus);
          setShowLogin(false);
        }}
      />
    </div>
  );
}
