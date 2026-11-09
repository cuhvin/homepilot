// The safety gate between the LLM and the Actor.
// Every step is checked against the device catalog, cleaned, clamped, and tagged with a risk tier.
// Nothing reaches the executor without passing through validatePlan().

import {
  ACTIONS, ALARM_MODES, DEVICE_BY_ID, MAX_STEPS, NAMED_COLORS, RANGES, THERMOSTAT_MODES, TV_INPUTS,
  type ParamName, type Risk,
} from '../home/devices.js';
import type { HomeState } from '../home/state.js';
import type { PlanStep, Repeat, StepParams } from './schema.js';

export interface NormalizedSchedule {
  at?: string; // HH:MM
  inMinutes?: number;
  repeat: Repeat;
}

export interface ValidatedStep {
  index: number;
  device: string;
  deviceLabel: string;
  action: string;
  params: StepParams;
  reason: string;
  schedule?: NormalizedSchedule;
  risk: Risk;
  blocked: boolean;
  blockReason?: string;
  warnings: string[]; // shown to the resident
  notes: string[]; // harmless clean-ups, kept for the audit log only
}

export function validatePlan(steps: PlanStep[], home: HomeState): ValidatedStep[] {
  const out: ValidatedStep[] = [];
  const seenImmediate = new Map<string, number>();

  steps.forEach((step, index) => {
    const v = validateStep(step, index, home);
    if (index >= MAX_STEPS) {
      v.blocked = true;
      v.blockReason = `Plans are limited to ${MAX_STEPS} steps.`;
    }
    if (!v.blocked && !v.schedule) {
      const key = `${v.device}:${v.action}`;
      const prev = seenImmediate.get(key);
      if (prev !== undefined) v.warnings.push(`Repeats step ${prev + 1}; the later value wins.`);
      seenImmediate.set(key, index);
    }
    out.push(v);
  });
  return out;
}

export function validateStep(step: PlanStep, index: number, home: HomeState): ValidatedStep {
  const base: ValidatedStep = {
    index,
    device: step.device,
    deviceLabel: step.device,
    action: step.action,
    params: {},
    reason: (step.reason || '').slice(0, 140),
    risk: 'safe',
    blocked: false,
    warnings: [],
    notes: [],
  };
  const block = (why: string): ValidatedStep => ({ ...base, blocked: true, blockReason: why });

  const info = DEVICE_BY_ID[step.device];
  if (!info) return block(`Unknown device "${step.device}".`);
  base.deviceLabel = `${info.label} (${info.room})`;

  const spec = ACTIONS[info.kind][step.action];
  if (!spec) {
    const allowed = Object.keys(ACTIONS[info.kind]).join(', ');
    return block(`"${step.action}" is not an action for a ${info.kind}. Allowed: ${allowed}.`);
  }
  base.risk = spec.risk;

  // ---- params: keep only allowed ones, type-check, clamp ----
  const params: StepParams = {};
  const raw = (step.params ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (raw[key] === null || raw[key] === undefined || raw[key] === '') continue;
    if (!spec.params.includes(key as ParamName)) {
      base.notes.push(`Ignored "${key}" (not used by ${step.action}).`);
      continue;
    }
    const res = cleanParam(key as ParamName, raw[key], info.kind);
    if ('error' in res) return block(res.error);
    if (res.warning) base.warnings.push(res.warning);
    (params as Record<string, unknown>)[key] = res.value;
  }
  for (const req of spec.required ?? []) {
    if (params[req] === undefined) return block(`${step.action} needs "${req}".`);
  }

  // ---- kind-specific safety rules ----
  if (info.kind === 'light') {
    if (params.on === undefined && params.brightness === undefined && params.color === undefined) {
      return block('Light step changes nothing (no on, brightness or color).');
    }
    if (params.on === undefined) params.on = params.brightness === undefined ? true : params.brightness > 0;
  }
  if ((info.kind === 'tv' || info.kind === 'speaker') && params.on === undefined) params.on = true;
  base.params = params;

  // ---- schedule ----
  if (step.schedule && (step.schedule.at || step.schedule.in_minutes)) {
    const s = step.schedule;
    const repeat: Repeat = s.repeat === 'daily' || s.repeat === 'weekdays' ? s.repeat : 'once';
    if (s.at) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(s.at).trim());
      if (!m || +m[1] > 23 || +m[2] > 59) return block(`Schedule time "${s.at}" is not HH:MM.`);
      base.schedule = { at: `${m[1].padStart(2, '0')}:${m[2]}`, repeat };
    } else {
      const n = Math.round(Number(s.in_minutes));
      if (!Number.isFinite(n) || n < 1 || n > 1440) return block('Schedule "in_minutes" must be 1-1440.');
      base.schedule = { inMinutes: n, repeat: 'once' };
      if (repeat !== 'once') base.warnings.push('Repeat ignored for "in N minutes" schedules.');
    }
  }

  // ---- no-op detection (immediate steps only) ----
  if (!base.schedule) {
    const noop = isNoop(home, step.device, step.action, params);
    if (noop) base.warnings.push(noop);
  }

  // ---- context escalation ----
  const alarm = home['home.alarm'];
  if (step.action === 'unlock' && alarm?.kind === 'alarm' && alarm.mode === 'away') {
    base.warnings.push('Alarm is armed (away): unlocking may trigger it.');
  }
  return base;
}

type CleanResult = { value: unknown; warning?: string } | { error: string };

function cleanParam(key: ParamName, value: unknown, kind: string): CleanResult {
  if (key === 'on') {
    if (typeof value === 'boolean') return { value };
    if (value === 'true' || value === 'false') return { value: value === 'true' };
    return { error: '"on" must be true or false.' };
  }
  if (key === 'color') {
    const s = String(value).trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return { value: s };
    if (NAMED_COLORS[s]) return { value: NAMED_COLORS[s] };
    return { value: NAMED_COLORS.warm, warning: `Unknown color "${value}", used warm white.` };
  }
  if (key === 'input') {
    const s = String(value).toLowerCase();
    if ((TV_INPUTS as readonly string[]).includes(s)) return { value: s };
    return { error: `TV input must be one of ${TV_INPUTS.join(', ')}.` };
  }
  if (key === 'mode') {
    const s = String(value).toLowerCase();
    const allowed: readonly string[] = kind === 'alarm' ? ALARM_MODES : THERMOSTAT_MODES;
    if (allowed.includes(s)) return { value: s };
    return { error: `Mode for ${kind} must be one of ${allowed.join(', ')}.` };
  }
  if (key === 'playlist') {
    const s = String(value).trim().slice(0, 40);
    return s ? { value: s } : { error: 'Playlist name is empty.' };
  }
  // numeric params
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return { error: `"${key}" must be a number.` };
  const range = RANGES[key];
  if (!range) return { value: n };
  const [lo, hi] = range;
  const rounded = key === 'target' ? Math.round(n * 2) / 2 : Math.round(n);
  if (rounded < lo || rounded > hi) {
    const clamped = Math.min(hi, Math.max(lo, rounded));
    return { value: clamped, warning: `${key} ${n} is outside ${lo}-${hi}; clamped to ${clamped}.` };
  }
  return { value: rounded };
}

function isNoop(home: HomeState, id: string, action: string, p: StepParams): string | null {
  const s = home[id];
  if (!s) return null;
  switch (s.kind) {
    case 'lock':
      if (action === 'lock' && s.locked) return 'Already locked.';
      if (action === 'unlock' && !s.locked) return 'Already unlocked.';
      return null;
    case 'garage':
      if (action === 'close' && !s.open) return 'Already closed.';
      if (action === 'open' && s.open) return 'Already open.';
      return null;
    case 'alarm':
      if (action === 'disarm' && s.mode === 'off') return 'Already disarmed.';
      if (action === 'arm' && s.mode === p.mode) return `Already armed (${s.mode}).`;
      return null;
    case 'light':
      if (p.on === false && !s.on) return 'Already off.';
      return null;
    default:
      return null;
  }
}

/** Steps that may run without a human click. */
export function needsConfirmation(step: ValidatedStep): boolean {
  return step.risk === 'sensitive';
}
