import { useCallback, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { HomePage } from '@/features/home/HomePage';
import { VhuPage } from '@/features/vhu/VhuPage';
import { HuflitPage } from '@/features/huflit/HuflitPage';

export default function App() {
  const [activePage, setActivePage] = useState(() => localStorage.getItem('activePage') || 'home');
  const [soundOn, setSoundOn] = useState(true);

  function navigate(page) {
    setActivePage(page);
    localStorage.setItem('activePage', page);
  }

  const handleToggleSound = useCallback(() => setSoundOn((v) => !v), []);

  return (
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-start gap-5 px-4 py-5 pb-10 lg:grid-cols-[264px_minmax(0,1fr)]">
      <Sidebar activePage={activePage} onSelect={navigate} />

      <main className="min-w-0">
        {activePage === 'home' && <HomePage onSelectSchool={navigate} />}
        {activePage === 'vhu' && <VhuPage soundOn={soundOn} onToggleSound={handleToggleSound} />}
        {activePage === 'huflit' && <HuflitPage soundOn={soundOn} onToggleSound={handleToggleSound} />}
      </main>
    </div>
  );
}
