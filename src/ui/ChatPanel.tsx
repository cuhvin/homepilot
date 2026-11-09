import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Logo } from './Logo';
import { useStore } from '../store';
import { PlanCard } from './PlanCard';

const EXAMPLES = [
  'Movie night',
  "I'm leaving for the weekend",
  'Every weekday at 7 AM: play music, open the blinds, warm up the house',
  'The dog walker comes at 3pm, let them in and lock up after',
  'Open the garage for a delivery',
  'Turn off the cameras',
  'Turn it up',
];

export function ChatPanel() {
  const chat = useStore((s) => s.chat);
  const busy = useStore((s) => s.busy);
  const cooldownUntil = useStore((s) => s.cooldownUntil);
  const send = useStore((s) => s.send);
  const [text, setText] = useState('');
  const [, force] = useState(0);
  const logRef = useRef<HTMLDivElement>(null);

  const cooldown = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    // scroll only the chat panel, never the whole page
    const el = logRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [chat.length, busy]);

  const submit = (value: string) => {
    if (!value.trim() || busy || cooldown) return;
    setText('');
    void send(value);
  };

  return (
    <div className="chat">
      <div className="chat__log" aria-live="polite" ref={logRef}>
        {chat.map((c) => (
          <div key={c.id} className={`msg msg--${c.role} ${c.tone ? `msg--${c.tone}` : ''}`}>
            {c.role === 'agent' && <span className="msg__avatar"><Logo size={28} /></span>}
            <div className="msg__body">
              <p>{c.text}</p>
              {c.planId && <PlanCard planId={c.planId} />}
            </div>
          </div>
        ))}
        {busy && (
          <div className="msg msg--agent">
            <span className="msg__avatar"><Logo size={28} /></span>
            <div className="msg__body"><p className="typing"><span /><span /><span /> planning…</p></div>
          </div>
        )}
      </div>

      <div className="chat__examples">
        {EXAMPLES.map((e) => (
          <button key={e} className="chip" disabled={busy || cooldown > 0} onClick={() => submit(e)}>{e}</button>
        ))}
      </div>

      <form className="chat__input" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={cooldown ? `Free-tier limit, wait ${cooldown}s…` : 'Tell HomePilot what you need…'}
          maxLength={500}
          disabled={busy}
          aria-label="Request"
        />
        <button className="btn btn--primary" disabled={busy || cooldown > 0 || !text.trim()} aria-label="Send">
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
