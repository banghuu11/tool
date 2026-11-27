import { useState } from 'react';
import { useSchoolWorkspace } from '@/features/school/useSchoolWorkspace';
import { SchoolHeader } from '@/features/school/SchoolHeader';
import { CourseLookupCard } from '@/features/school/CourseLookupCard';
import { WatcherPanel } from '@/features/school/WatcherPanel';
import { LogPanel } from '@/features/school/LogPanel';
import { VhuLoginDialog } from './VhuLoginDialog';

export function VhuPage({ soundOn, onToggleSound, onBackHome }) {
  const [showLogin, setShowLogin] = useState(false);
  const { status, setStatus, refresh, queuedItems, addToQueue, removeQueued, clearQueued } =
    useSchoolWorkspace('vhu', soundOn);

  return (
    <div className="space-y-5">
      <SchoolHeader
        school="vhu"
        status={status}
        soundOn={soundOn}
        onToggleSound={onToggleSound}
        onOpenLogin={() => setShowLogin(true)}
        onBackHome={onBackHome}
      />

      <CourseLookupCard school="vhu" onAddToQueue={addToQueue} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
        <WatcherPanel
          school="vhu"
          queuedItems={queuedItems}
          onRemoveQueued={removeQueued}
          onClearQueued={clearQueued}
          jobs={status?.jobs || []}
          onRefresh={refresh}
        />
        <LogPanel logs={status?.logs || []} />
      </div>

      <VhuLoginDialog
        open={showLogin}
        loginBlocked={Boolean(status?.login_blocked)}
        loginBlockReason={status?.login_block_reason || ''}
        onClose={() => setShowLogin(false)}
        onSuccess={(newStatus) => {
          setStatus(newStatus);
          setShowLogin(false);
        }}
      />
    </div>
  );
}
