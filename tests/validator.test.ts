import { describe, expect, it } from 'vitest';
import { validatePlan, validateStep, needsConfirmation } from '../src/agent/validator.ts';
import { parseAgentResponse } from '../src/agent/schema.ts';
import { applyStep, firstRun, nextRun, tickHome } from '../src/agent/executor.ts';
import { initialHome, START_MINUTES, formatClock } from '../src/home/state.ts';
import { mockPlan } from '../src/agent/mock.ts';
import type { PlanStep } from '../src/agent/schema.ts';

const home = initialHome();
const step = (s: Partial<PlanStep>): PlanStep => ({ device: 'living.lamp', action: 'set', params: {}, reason: 'test', ...s });

describe('validator: rejects what the LLM must not do', () => {
  it('blocks unknown devices', () => {
    const v = validateStep(step({ device: 'kitchen.toaster' }), 0, home);
    expect(v.blocked).toBe(true);
    expect(v.blockReason).toMatch(/Unknown device/);
  });

  it('blocks actions a device does not support', () => {
    const v = validateStep(step({ device: 'entry.frontdoor', action: 'explode' }), 0, home);
    expect(v.blocked).toBe(true);
    expect(v.blockReason).toMatch(/not an action/);
  });

  it('blocks invalid enum values', () => {
    const v = validateStep(step({ device: 'living.tv', params: { input: 'netflix-hack' } }), 0, home);
    expect(v.blocked).toBe(true);
  });

  it('blocks a light step that changes nothing', () => {
    expect(validateStep(step({ params: {} }), 0, home).blocked).toBe(true);
  });

  it('blocks malformed schedule times', () => {
    const v = validateStep(step({ params: { on: true }, schedule: { at: '25:99' } }), 0, home);
    expect(v.blocked).toBe(true);
  });

  it('blocks steps beyond the plan size limit', () => {
    const many = Array.from({ length: 20 }, () => step({ params: { on: true } }));
    const out = validatePlan(many, home);
    expect(out.filter((s) => s.blocked).length).toBe(4);
  });
});

describe('validator: clamps and repairs', () => {
  it('clamps thermostat to 60-85F', () => {
    const v = validateStep(step({ device: 'home.thermostat', params: { target: 99 } }), 0, home);
    expect(v.blocked).toBe(false);
    expect(v.params.target).toBe(85);
    expect(v.warnings.join(' ')).toMatch(/clamped/);
  });

  it('clamps brightness and maps named colors', () => {
    const v = validateStep(step({ params: { brightness: 180, color: 'Purple' } }), 0, home);
    expect(v.params.brightness).toBe(100);
    expect(v.params.color).toBe('#a46bff');
    expect(v.params.on).toBe(true);
  });

  it('blocks devices that were removed from the home', () => {
    const v = validateStep(step({ device: 'kitchen.oven', action: 'preheat' }), 0, home);
    expect(v.blocked).toBe(true);
  });

  it('drops parameters the action does not use', () => {
    const v = validateStep(step({ device: 'entry.frontdoor', action: 'lock', params: { brightness: 50 } }), 0, home);
    expect(v.params).toEqual({});
    expect(v.notes.join(' ')).toMatch(/Ignored/);
    expect(v.warnings.join(' ')).not.toMatch(/Ignored/);
  });
});

describe('risk tiers', () => {
  it('marks security actions as sensitive (never auto-run)', () => {
    for (const [device, action] of [['entry.frontdoor', 'unlock'], ['garage.door', 'open'], ['home.alarm', 'disarm'], ['home.cameras', 'off']]) {
      const v = validateStep(step({ device, action }), 0, home);
      expect(v.risk, `${device} ${action}`).toBe('sensitive');
      expect(needsConfirmation(v)).toBe(true);
    }
  });

  it('lets comfort actions run automatically', () => {
    const v = validateStep(step({ params: { on: true } }), 0, home);
    expect(v.risk).toBe('safe');
    expect(needsConfirmation(v)).toBe(false);
  });
});

describe('parser: malformed LLM output', () => {
  it('rejects non-JSON', () => {
    const r = parseAgentResponse('Sure! Here is your plan: dim the lights');
    expect(r.ok).toBe(false);
  });
  it('rejects a bad kind', () => {
    const r = parseAgentResponse('{"kind":"execute","understanding":"","steps":[],"checks":[],"message":"hi"}');
    expect(r.ok).toBe(false);
  });
  it('accepts fenced JSON', () => {
    const r = parseAgentResponse('```json\n{"kind":"clarify","understanding":"x","steps":[],"checks":[],"message":"Which room?"}\n```');
    expect(r.ok).toBe(true);
  });
  it('parses every mock response', () => {
    for (const q of ['movie night', 'leaving for the weekend', 'dog walker', 'weekday morning', 'open the garage', 'turn off the cameras', 'order pizza', 'turn it up']) {
      expect(parseAgentResponse(mockPlan(q)).ok, q).toBe(true);
    }
  });
});

describe('executor + scheduling', () => {
  it('unlocking sets an auto-relock that fires on the clock', () => {
    const v = validateStep(step({ device: 'entry.frontdoor', action: 'unlock' }), 0, home);
    const after = applyStep(home, v).home;
    expect(after['entry.frontdoor']).toMatchObject({ locked: false, relockIn: 15 });
    const later = tickHome(after, 15);
    expect(later.home['entry.frontdoor']).toMatchObject({ locked: true });
    expect(later.events[0].message).toMatch(/auto-relocked/);
  });

  it('thermostat drifts toward its target over time', () => {
    const v = validateStep(step({ device: 'home.thermostat', params: { target: 64, mode: 'cool' } }), 0, home);
    const set = applyStep(home, v).home;
    const later = tickHome(set, 120).home['home.thermostat'];
    expect(later.kind === 'thermostat' && later.current).toBeLessThan(66);
  });

  it('never executes a blocked step', () => {
    const v = validateStep(step({ device: 'kitchen.toaster' }), 0, home);
    expect(applyStep(home, v).ok).toBe(false);
  });

  it('weekday schedules skip the weekend', () => {
    // START is Friday 17:40, so "weekdays at 07:00" should next run Monday 07:00
    const t = firstRun({ at: '07:00', repeat: 'weekdays' }, START_MINUTES);
    expect(formatClock(t)).toBe('Mon 07:00');
    const n = nextRun({ at: '07:00', repeat: 'weekdays' }, t)!;
    expect(formatClock(n)).toBe('Tue 07:00');
    expect(nextRun({ at: '07:00', repeat: 'once' }, t)).toBeNull();
  });

  it('"in N minutes" schedules are relative to now', () => {
    expect(firstRun({ inMinutes: 20, repeat: 'once' }, START_MINUTES)).toBe(START_MINUTES + 20);
  });
});
