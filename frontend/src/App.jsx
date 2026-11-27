import { useCallback, useState } from 'react';
import SchoolNav from './components/SchoolNav.jsx';
import HomeView from './components/HomeView.jsx';
import VhuView from './components/VhuView.jsx';
import HuflitView from './components/HuflitView.jsx';

function playBeep(freq = 880, duration = 0.25) {
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
    // ignore audio errors when browser blocks autoplay
  }
}

export default function App() {
  const [activePage, setActivePage] = useState(() => localStorage.getItem('activePage') || 'home');
  const [soundOn, setSoundOn] = useState(true);

  function navigate(page) {
    setActivePage(page);
    localStorage.setItem('activePage', page);
  }

  const handleToggleSound = useCallback(() => setSoundOn((v) => !v), []);

  return (
    <div className="app-shell">
      <SchoolNav activePage={activePage} onSelect={navigate} />

      <main className="main-content">
        {activePage === 'home' && <HomeView onSelectSchool={navigate} />}

        {activePage === 'vhu' && (
          <VhuView soundOn={soundOn} onToggleSound={handleToggleSound} onBeep={playBeep} />
        )}

        {activePage === 'huflit' && (
          <HuflitView soundOn={soundOn} onToggleSound={handleToggleSound} onBeep={playBeep} />
        )}
      </main>
    </div>
  );
}
