import { lazy, Suspense, useEffect, useState } from 'react';
import { MessageSquare, ScrollText } from 'lucide-react';
import { useStore } from './store';
import { ChatPanel } from './ui/ChatPanel';
import { LogPanel } from './ui/LogPanel';
import { HousePanel, Upcoming } from './ui/HousePanel';
import { ClockBar } from './ui/ClockBar';
import { HomeStatus } from './ui/HomeStatus';
import { PixelStreet } from './ui/PixelStreet';
import { HowToUse } from './ui/HowToUse';
import { Logo } from './ui/Logo';

const LivingRoomScene = lazy(() => import('./ui/scene/LivingRoomScene'));

/** Drives the simulated clock: `speed` simulated minutes per real second. */
function useSimClock() {
  const advance = useStore((s) => s.advance);
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      const dt = (t - last) / 1000;
      last = t;
      const speed = useStore.getState().speed;
      if (speed > 0) advance(speed * dt);
    }, 250);
    return () => clearInterval(id);
  }, [advance]);
}

export default function App() {
  useSimClock();
  const [tab, setTab] = useState<'chat' | 'log'>('chat');
  const logCount = useStore((s) => s.log.length);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            <h1>HomePilot</h1>
            <p>Plain language in, safe smart-home actions out</p>
          </div>
        </div>
        <ClockBar />
      </header>

      <main className="layout">
        <div className="left">
          <section className="stage">
            <Suspense fallback={<div className="scene scene--loading">Loading the living room…</div>}>
              <LivingRoomScene />
            </Suspense>
            <HomeStatus />
            <p className="stage__hint">Drag to rotate · hover a device</p>
          </section>

          <HousePanel />
          <div className="bottom">
            <PixelStreet />
            <Upcoming />
          </div>
          <HowToUse />
        </div>

        <aside className="side">
          <div className="side__inner">
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'is-on' : ''} onClick={() => setTab('chat')}>
                <MessageSquare size={15} /> Assistant
              </button>
              <button role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'is-on' : ''} onClick={() => setTab('log')}>
                <ScrollText size={15} /> Audit log <span className="badge">{logCount}</span>
              </button>
            </div>
            <div className="side__body">{tab === 'chat' ? <ChatPanel /> : <LogPanel />}</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
