import { Pause, Play, FastForward, RotateCcw } from 'lucide-react';
import { useStore } from '../store';
import { formatClock, daylight } from '../home/state';

const SPEEDS = [1, 10, 60];

export function ClockBar() {
  const now = useStore((s) => s.now);
  const speed = useStore((s) => s.speed);
  const setSpeed = useStore((s) => s.setSpeed);
  const advance = useStore((s) => s.advance);
  const resetHome = useStore((s) => s.resetHome);
  const d = daylight(now);
  return (
    <div className="clock">
      <span className="clock__time" title="Simulated time">
        <span className="clock__sun" style={{ background: d > 0.5 ? '#ffd166' : d > 0.05 ? '#ff9466' : '#c9d4ff' }} />
        {formatClock(now)}
      </span>
      <div className="clock__btns" role="group" aria-label="Simulation speed">
        <button className={`btn btn--seg ${speed === 0 ? 'is-on' : ''}`} onClick={() => setSpeed(speed === 0 ? 1 : 0)} aria-label={speed === 0 ? 'Resume' : 'Pause'}>
          {speed === 0 ? <Play size={14} /> : <Pause size={14} />}
        </button>
        {SPEEDS.map((s) => (
          <button key={s} className={`btn btn--seg ${speed === s ? 'is-on' : ''}`} onClick={() => setSpeed(s)} title={`${s} simulated minute${s > 1 ? 's' : ''} per second`}>
            {s}×
          </button>
        ))}
        <button className="btn btn--seg" onClick={() => advance(60)} title="Skip ahead one hour"><FastForward size={14} /> 1h</button>
        <button className="btn btn--seg" onClick={() => { if (confirm('Reset the house, clock and plans?')) resetHome(); }} title="Reset home"><RotateCcw size={14} /></button>
      </div>
    </div>
  );
}
