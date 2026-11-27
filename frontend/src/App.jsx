import { useCallback, useEffect, useState } from 'react';
import { HomePage } from '@/features/home/HomePage';
import { VhuPage } from '@/features/vhu/VhuPage';
import { HuflitPage } from '@/features/huflit/HuflitPage';

function getPageFromHash() {
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (h === 'vhu' || h === 'huflit') return h;
  return 'home';
}

export default function App() {
  const [activePage, setActivePage] = useState(getPageFromHash);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    const onHashChange = () => setActivePage(getPageFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function navigate(page) {
    setActivePage(page);
    window.location.hash = page === 'home' ? '' : `#/${page}`;
  }

  const handleToggleSound = useCallback(() => setSoundOn((v) => !v), []);

  if (activePage === 'home') {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 pb-12">
        <HomePage onSelectSchool={navigate} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 pb-12">
      {activePage === 'vhu' && (
        <VhuPage
          soundOn={soundOn}
          onToggleSound={handleToggleSound}
          onBackHome={() => navigate('home')}
        />
      )}
      {activePage === 'huflit' && (
        <HuflitPage
          soundOn={soundOn}
          onToggleSound={handleToggleSound}
          onBackHome={() => navigate('home')}
        />
      )}
    </main>
  );
}
