// Home state model + simulated clock helpers. Pure data, no React.

import { DEVICES, DEVICE_BY_ID } from './devices.js';

export interface LightState { kind: 'light'; on: boolean; brightness: number; color: string }
export interface BlindsState { kind: 'blinds'; position: number }
export interface TvState { kind: 'tv'; on: boolean; input: string; volume: number }
export interface SpeakerState { kind: 'speaker'; on: boolean; playlist: string; volume: number }
export interface VacuumState { kind: 'vacuum'; running: boolean; minutesLeft: number }
export interface ThermostatState { kind: 'thermostat'; target: number; mode: string; current: number }
export interface LockState { kind: 'lock'; locked: boolean; relockIn: number }
export interface GarageState { kind: 'garage'; open: boolean }
export interface AlarmState { kind: 'alarm'; mode: 'off' | 'home' | 'away' }
export interface CameraState { kind: 'camera'; on: boolean }

export type DeviceState =
  | LightState | BlindsState | TvState | SpeakerState | VacuumState | ThermostatState
  | LockState | GarageState | AlarmState | CameraState;

export type HomeState = Record<string, DeviceState>;

export function initialHome(): HomeState {
  return {
    'living.ceiling': { kind: 'light', on: true, brightness: 80, color: '#fff4e5' },
    'living.lamp': { kind: 'light', on: false, brightness: 60, color: '#ffb46b' },
    'living.strip': { kind: 'light', on: false, brightness: 70, color: '#a46bff' },
    'living.blinds': { kind: 'blinds', position: 100 },
    'living.tv': { kind: 'tv', on: false, input: 'movies', volume: 25 },
    'living.speaker': { kind: 'speaker', on: false, playlist: 'Lo-fi Evening', volume: 30 },
    'living.vacuum': { kind: 'vacuum', running: false, minutesLeft: 0 },
    'home.thermostat': { kind: 'thermostat', target: 70, mode: 'auto', current: 72 },
    'entry.frontdoor': { kind: 'lock', locked: true, relockIn: 0 },
    'garage.door': { kind: 'garage', open: false },
    'home.alarm': { kind: 'alarm', mode: 'off' },
    'home.cameras': { kind: 'camera', on: true },
  };
}

/** One short phrase describing a device's state, used in prompts and UI. */
export function describeDevice(s: DeviceState): string {
  switch (s.kind) {
    case 'light': return s.on ? `on, ${s.brightness}%, color ${s.color}` : 'off';
    case 'blinds': return `${s.position}% open`;
    case 'tv': return s.on ? `on, ${s.input}, volume ${s.volume}` : 'off';
    case 'speaker': return s.on ? `playing "${s.playlist}", volume ${s.volume}` : 'off';
    case 'vacuum': return s.running ? `cleaning (${s.minutesLeft} min left)` : 'docked';
    case 'thermostat': return `mode ${s.mode}, target ${s.target}F, currently ${Math.round(s.current)}F`;
    case 'lock': return s.locked ? 'locked' : `UNLOCKED (auto-relock in ${s.relockIn} min)`;
    case 'garage': return s.open ? 'OPEN' : 'closed';
    case 'alarm': return s.mode === 'off' ? 'disarmed' : `armed (${s.mode})`;
    case 'camera': return s.on ? 'recording' : 'OFF';
  }
}

/** Compact state listing that is injected into the prompt (context injection). */
export function homeForPrompt(home: HomeState): string {
  return DEVICES.map((d) => {
    const s = home[d.id];
    return `- ${d.id} [${d.kind}] ${d.room} / ${d.label}: ${s ? describeDevice(s) : 'unknown'}`;
  }).join('\n');
}

// ---------- simulated clock ----------
// Time is "minutes since Monday 00:00" so schedules like "weekdays at 7:00" are easy.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const START_MINUTES = 4 * 1440 + 17 * 60 + 40; // simulation starts Friday 17:40

export function dayIndex(min: number): number {
  return Math.floor(min / 1440) % 7;
}

export function minuteOfDay(min: number): number {
  return ((min % 1440) + 1440) % 1440;
}

export function formatClock(min: number): string {
  const m = minuteOfDay(Math.floor(min));
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${DAY_NAMES[dayIndex(Math.floor(min))]} ${hh}:${mm}`;
}

/** 0 at midnight, 1 at noon: how much daylight there is (smooth curve). */
export function daylight(min: number): number {
  const h = minuteOfDay(min) / 60;
  // sunrise ~6:30, sunset ~18:45
  const rise = smooth(5.8, 7.4, h);
  const set = 1 - smooth(18.0, 19.6, h);
  return Math.max(0, Math.min(rise, set));
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function isDeviceId(id: string): boolean {
  return id in DEVICE_BY_ID;
}
