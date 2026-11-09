import { lazy, Suspense, useEffect, useState } from 'react';
import { House, MessageSquare, ScrollText } from 'lucide-react';
import { useStore } from './store';
import { ChatPanel } from './ui/ChatPanel';
import { LogPanel } from './ui/LogPanel';
import { HousePanel } from './ui/HousePanel';
import { ClockBar } from './ui/ClockBar';
import { HomeStatus } from './ui/HomeStatus';

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
          <span className="brand__logo"><House size={18} /></span>
          <div>
            <h1>HomePilot</h1>
            <p>An AI agent that turns plain language into safe smart-home actions</p>
          </div>
        </div>
        <ClockBar />
      </header>

      <main className="layout">
        <section className="stage">
          <Suspense fallback={<div className="scene scene--loading">Loading the living room…</div>}>
            <LivingRoomScene />
          </Suspense>
          <HomeStatus />
          <p className="stage__hint">Drag to rotate · hover a device for its state</p>
        </section>

        <aside className="side">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'is-on' : ''} onClick={() => setTab('chat')}>
              <MessageSquare size={15} /> Assistant
            </button>
            <button role="tab" aria-selected={tab === 'log'} className={tab === 'log' ? 'is-on' : ''} onClick={() => setTab('log')}>
              <ScrollText size={15} /> Audit log <span className="badge">{logCount}</span>
            </button>
          </div>
          <div className="side__body">{tab === 'chat' ? <ChatPanel /> : <LogPanel />}</div>
        </aside>

        <HousePanel />
      </main>
    </div>
  );
}
