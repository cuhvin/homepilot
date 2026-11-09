import type { ReactNode } from 'react';
import {
  Lock, LockOpen, Warehouse, ShieldCheck, ShieldOff, Cctv, CameraOff, Thermometer, CalendarClock,
} from 'lucide-react';
import { useStore } from '../store';
import { formatClock, describeDevice, type DeviceState } from '../home/state';
import { describeSchedule } from '../agent/executor';

interface CardSpec {
  id: string;
  title: string;
  icon: (s: DeviceState) => ReactNode;
  tone: (s: DeviceState) => 'ok' | 'warn' | 'active' | 'idle';
}

const CARDS: CardSpec[] = [
  { id: 'entry.frontdoor', title: 'Front door', icon: (s) => (s.kind === 'lock' && !s.locked ? <LockOpen /> : <Lock />), tone: (s) => (s.kind === 'lock' && !s.locked ? 'warn' : 'ok') },
  { id: 'home.alarm', title: 'Alarm', icon: (s) => (s.kind === 'alarm' && s.mode === 'off' ? <ShieldOff /> : <ShieldCheck />), tone: (s) => (s.kind === 'alarm' && s.mode !== 'off' ? 'ok' : 'idle') },
  { id: 'garage.door', title: 'Garage', icon: () => <Warehouse />, tone: (s) => (s.kind === 'garage' && s.open ? 'warn' : 'ok') },
  { id: 'home.cameras', title: 'Cameras', icon: (s) => (s.kind === 'camera' && !s.on ? <CameraOff /> : <Cctv />), tone: (s) => (s.kind === 'camera' && !s.on ? 'warn' : 'ok') },
  { id: 'home.thermostat', title: 'Thermostat', icon: () => <Thermometer />, tone: () => 'active' },
];

export function HousePanel() {
  const home = useStore((s) => s.home);
  const highlight = useStore((s) => s.highlight);
  const plans = useStore((s) => s.plans);
  const tasks = useStore((s) => s.tasks);
  const pending = new Set(Object.values(plans).flatMap((p) => p.steps.filter((st) => st.status === 'awaiting').map((st) => st.device)));
  const upcoming = [...tasks].sort((a, b) => a.runAt - b.runAt).slice(0, 5);

  return (
    <section className="house" aria-label="Security and climate">
      <div className="house__grid">
        {CARDS.map((c) => {
          const s = home[c.id];
          if (!s) return null;
          return (
            <div key={c.id} className={`card card--${c.tone(s)} ${highlight === c.id ? 'card--flash' : ''} ${pending.has(c.id) ? 'card--pending' : ''}`}>
              <span className="card__icon">{c.icon(s)}</span>
              <div className="card__text">
                <span className="card__title">{c.title}</span>
                <span className="card__state">{short(s)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="upcoming">
        <h3><CalendarClock size={14} /> Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="muted">Nothing scheduled. Try "weekday mornings at 7".</p>
        ) : (
          <ul>
            {upcoming.map((t) => (
              <li key={t.id}>
                <time>{formatClock(t.runAt)}</time>
                <span>{t.step.deviceLabel.replace(/ \(.*\)$/, '')}: {t.step.action}{t.step.schedule && t.step.schedule.repeat !== 'once' ? ` (${describeSchedule(t.step.schedule).replace(/^at \S+ /, '')})` : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function short(s: DeviceState): string {
  switch (s.kind) {
    case 'thermostat': return `${Math.round(s.current)}° → ${s.target}°`;
    case 'light': return s.on ? `on · ${s.brightness}%` : 'off';
    case 'lock': return s.locked ? 'Locked' : `Unlocked ${s.relockIn}m`;
    case 'alarm': return s.mode === 'off' ? 'Disarmed' : `Armed ${s.mode}`;
    case 'garage': return s.open ? 'Open' : 'Closed';
    case 'camera': return s.on ? 'Recording' : 'Off';
    default: return describeDevice(s);
  }
}
