// The Actor: applies validated steps to the home, advances the simulated clock,
// and fires scheduled tasks. Pure functions: (state, input) -> new state + events.

import type { HomeState, DeviceState } from '../home/state.js';
import { minuteOfDay, dayIndex } from '../home/state.js';
import type { ValidatedStep, NormalizedSchedule } from './validator.js';

export interface ExecResult {
  home: HomeState;
  ok: boolean;
  message: string;
}

export function applyStep(home: HomeState, step: ValidatedStep): ExecResult {
  if (step.blocked) return { home, ok: false, message: `Blocked: ${step.blockReason}` };
  const cur = home[step.device];
  if (!cur) return { home, ok: false, message: `Device ${step.device} is offline.` };
  const p = step.params;
  let next: DeviceState;
  let msg: string;

  switch (cur.kind) {
    case 'light':
      next = { ...cur, on: p.on ?? cur.on, brightness: p.brightness ?? cur.brightness, color: p.color ?? cur.color };
      if (next.on && next.brightness === 0) next.brightness = 50;
      msg = next.on ? `light on at ${next.brightness}%` : 'light off';
      break;
    case 'blinds':
      next = { ...cur, position: p.position ?? cur.position };
      msg = `blinds ${next.position}% open`;
      break;
    case 'tv':
      next = { ...cur, on: p.on ?? cur.on, input: p.input ?? cur.input, volume: p.volume ?? cur.volume };
      msg = next.on ? `TV on (${next.input}, vol ${next.volume})` : 'TV off';
      break;
    case 'speaker':
      next = { ...cur, on: p.on ?? cur.on, playlist: p.playlist ?? cur.playlist, volume: p.volume ?? cur.volume };
      msg = next.on ? `playing "${next.playlist}"` : 'speaker off';
      break;
    case 'vacuum':
      next = step.action === 'start' ? { ...cur, running: true, minutesLeft: 30 } : { ...cur, running: false, minutesLeft: 0 };
      msg = step.action === 'start' ? 'vacuum started' : 'vacuum docked';
      break;
    case 'thermostat':
      next = { ...cur, target: p.target ?? cur.target, mode: p.mode ?? cur.mode };
      msg = `thermostat ${next.mode}, target ${next.target}F`;
      break;
    case 'lock':
      next = step.action === 'unlock' ? { ...cur, locked: false, relockIn: 15 } : { ...cur, locked: true, relockIn: 0 };
      msg = step.action === 'unlock' ? 'front door unlocked (auto-relock in 15 min)' : 'front door locked';
      break;
    case 'garage':
      next = { ...cur, open: step.action === 'open' };
      msg = `garage ${next.open ? 'opened' : 'closed'}`;
      break;
    case 'alarm':
      next = step.action === 'disarm' ? { ...cur, mode: 'off' } : { ...cur, mode: p.mode === 'home' ? 'home' : 'away' };
      msg = next.mode === 'off' ? 'alarm disarmed' : `alarm armed (${next.mode})`;
      break;
    case 'camera':
      next = { ...cur, on: step.action === 'on' };
      msg = `cameras ${next.on ? 'on' : 'off'}`;
      break;
  }
  return { home: { ...home, [step.device]: next }, ok: true, message: msg };
}

export interface TickEvent { device: string; message: string }

/** Advance timers by `minutes` of simulated time (whole minutes only). */
export function tickHome(home: HomeState, minutes: number): { home: HomeState; events: TickEvent[] } {
  if (minutes <= 0) return { home, events: [] };
  const events: TickEvent[] = [];
  const next: HomeState = { ...home };
  for (const [id, s] of Object.entries(home)) {
    switch (s.kind) {
      case 'lock':
        if (!s.locked && s.relockIn > 0) {
          const left = s.relockIn - minutes;
          next[id] = left <= 0 ? { ...s, locked: true, relockIn: 0 } : { ...s, relockIn: left };
          if (left <= 0) events.push({ device: id, message: 'Front door auto-relocked (safety).' });
        }
        break;
      case 'vacuum':
        if (s.running) {
          const left = s.minutesLeft - minutes;
          next[id] = left <= 0 ? { ...s, running: false, minutesLeft: 0 } : { ...s, minutesLeft: left };
          if (left <= 0) events.push({ device: id, message: 'Robot vacuum finished and docked.' });
        }
        break;
      case 'thermostat': {
        // drift current temperature toward target (or outdoors ~66F when off)
        const goal = s.mode === 'off' ? 66 : s.mode === 'eco' ? (s.target > 70 ? s.target - 4 : s.target + 4) : s.target;
        const current = s.current + (goal - s.current) * (1 - Math.pow(0.97, minutes));
        next[id] = { ...s, current: Math.round(current * 10) / 10 };
        break;
      }
      default:
        break;
    }
  }
  return { home: next, events };
}

// ---------- scheduling ----------

/** First simulated minute >= now (strictly after `after` when given) at which the schedule fires. */
export function firstRun(s: NormalizedSchedule, now: number): number {
  if (s.inMinutes !== undefined) return now + s.inMinutes;
  const [h, m] = (s.at ?? '00:00').split(':').map(Number);
  const tod = h * 60 + m;
  let t = now - minuteOfDay(now) + tod;
  if (t <= now) t += 1440;
  return advanceToAllowedDay(t, s.repeat);
}

export function nextRun(s: NormalizedSchedule, last: number): number | null {
  if (s.repeat === 'once') return null;
  return advanceToAllowedDay(last + 1440, s.repeat);
}

function advanceToAllowedDay(t: number, repeat: NormalizedSchedule['repeat']): number {
  if (repeat !== 'weekdays') return t;
  while (dayIndex(t) >= 5) t += 1440;
  return t;
}

export function describeSchedule(s: NormalizedSchedule): string {
  if (s.inMinutes !== undefined) return `in ${s.inMinutes} min`;
  const rep = s.repeat === 'once' ? '' : s.repeat === 'daily' ? ' every day' : ' on weekdays';
  return `at ${s.at}${rep}`;
}
