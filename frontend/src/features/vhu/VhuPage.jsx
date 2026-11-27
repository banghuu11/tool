import { useState } from 'react';
import { useSchoolWorkspace } from '@/features/school/useSchoolWorkspace';
import { SchoolHeader } from '@/features/school/SchoolHeader';
import { CourseLookupCard } from '@/features/school/CourseLookupCard';
import { WatcherPanel } from '@/features/school/WatcherPanel';
import { LogPanel } from '@/features/school/LogPanel';
import { RegisteredCoursesCard } from '@/features/school/RegisteredCoursesCard';
import { VhuLoginDialog } from './VhuLoginDialog';

export function VhuPage({ soundOn, onToggleSound, onBackHome }) {
  const [showLogin, setShowLogin] = useState(false);
  const {
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
  } = useSchoolWorkspace('vhu', soundOn);

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

      <CourseLookupCard school="vhu" portal={portal} onAddToQueue={addToQueue} />

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

      <RegisteredCoursesCard
        portal={portal}
        loading={portalLoading}
        onRefresh={refreshPortal}
        tokenValid={Boolean(status?.token_valid)}
      />

      <VhuLoginDialog
        open={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={(newStatus) => {
          setStatus(newStatus);
          setShowLogin(false);
          refreshPortal();
        }}
      />
    </div>
  );
}
