// App state + the agent loop that ties everything together:
//   request -> /api/plan (LLM) -> validatePlan -> auto-run safe steps / await confirmation
//   for sensitive ones / queue scheduled ones -> executor -> audit log.

import { create } from 'zustand';
import type { AgentResponse } from './agent/schema';
import { validatePlan, needsConfirmation, type ValidatedStep } from './agent/validator';
import { applyStep, tickHome, firstRun, nextRun, describeSchedule } from './agent/executor';
import { loadLog, saveLog, makeEntry, type LogEntry, type LogType } from './agent/log';
import { initialHome, formatClock, START_MINUTES, type HomeState } from './home/state';

export type StepStatus = 'queued' | 'awaiting' | 'done' | 'scheduled' | 'rejected' | 'blocked' | 'failed';

export interface StepRun extends ValidatedStep {
  status: StepStatus;
  result?: string;
}

export interface PlanRun {
  id: string;
  request: string;
  response: AgentResponse;
  steps: StepRun[];
  meta?: { model: string; attempts: number; repaired: boolean; latencyMs: number };
  raw?: string;
}

export interface ChatItem {
  id: string;
  role: 'user' | 'agent' | 'system';
  text: string;
  planId?: string;
  tone?: 'info' | 'warn' | 'error';
}

export interface ScheduledTask {
  id: string;
  planId: string;
  stepIndex: number;
  step: ValidatedStep;
  runAt: number;
}

interface Store {
  home: HomeState;
  now: number; // simulated minutes (float)
  speed: number; // simulated minutes per real second
  chat: ChatItem[];
  plans: Record<string, PlanRun>;
  tasks: ScheduledTask[];
  log: LogEntry[];
  busy: boolean;
  cooldownUntil: number; // epoch ms, set after a 429
  highlight: string | null;

  send: (text: string) => Promise<void>;
  confirmStep: (planId: string, index: number) => void;
  rejectStep: (planId: string, index: number) => void;
  confirmAll: (planId: string) => void;
  advance: (simMinutes: number) => void;
  setSpeed: (s: number) => void;
  setHighlight: (id: string | null) => void;
  resetHome: () => void;
  clearLog: () => void;
}

let idc = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(idc++).toString(36)}`;

export const useStore = create<Store>((set, get) => {
  const log = (type: LogType, message: string, data?: unknown) => {
    const entry = makeEntry(type, formatClock(get().now), message, data);
    set((s) => ({ log: [...s.log, entry].slice(-400) }));
    saveLog(get().log);
  };
  const say = (role: ChatItem['role'], text: string, extra: Partial<ChatItem> = {}) =>
    set((s) => ({ chat: [...s.chat, { id: uid('c'), role, text, ...extra }] }));

  const updateStep = (planId: string, index: number, patch: Partial<StepRun>) =>
    set((s) => {
      const plan = s.plans[planId];
      if (!plan) return s;
      const steps = plan.steps.map((st) => (st.index === index ? { ...st, ...patch } : st));
      return { plans: { ...s.plans, [planId]: { ...plan, steps } } };
    });

  /** Execute or schedule one already-approved step. */
  const runStep = (planId: string, step: StepRun) => {
    if (step.schedule) {
      const runAt = firstRun(step.schedule, Math.floor(get().now));
      set((s) => ({ tasks: [...s.tasks, { id: uid('t'), planId, stepIndex: step.index, step, runAt }] }));
      updateStep(planId, step.index, { status: 'scheduled', result: `${describeSchedule(step.schedule)} (next ${formatClock(runAt)})` });
      log('schedule', `${step.deviceLabel}: ${step.action} ${describeSchedule(step.schedule)}`, { step, runAt: formatClock(runAt) });
      return;
    }
    const res = applyStep(get().home, step);
    set({ home: res.home });
    updateStep(planId, step.index, { status: res.ok ? 'done' : 'failed', result: res.message });
    log(res.ok ? 'execute' : 'blocked', `${step.deviceLabel}: ${res.message}`, { device: step.device, action: step.action, params: step.params });
  };

  /** Run the auto-approved steps one by one so the scene animates each change. */
  const runQueued = async (planId: string) => {
    const plan = get().plans[planId];
    if (!plan) return;
    for (const st of plan.steps) {
      if (st.status !== 'queued') continue;
      set({ highlight: st.device });
      runStep(planId, st);
      await new Promise((r) => setTimeout(r, st.schedule ? 120 : 420));
    }
    set({ highlight: null });
  };

  return {
    home: initialHome(),
    now: START_MINUTES,
    speed: 1,
    chat: [{ id: 'hello', role: 'agent', text: "Hi! I'm HomePilot. Tell me what you need, like \"movie night\" or \"I'm leaving for the weekend\". I'll show you my plan, and anything security-related waits for your OK. The clock up top is simulated: speed it up to watch scheduled actions happen." }],
    plans: {},
    tasks: [],
    log: loadLog(),
    busy: false,
    cooldownUntil: 0,
    highlight: null,

    async send(text) {
      const request = text.trim();
      if (!request || get().busy) return;
      if (Date.now() < get().cooldownUntil) return;
      const history = get().chat
        .filter((c) => c.role !== 'system' && c.id !== 'hello')
        .slice(-6)
        .map((c) => ({ role: c.role as 'user' | 'agent', text: c.text }));
      say('user', request);
      set({ busy: true });
      log('request', request);

      let data: Record<string, unknown>;
      try {
        const res = await fetch('/api/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ request, time: formatClock(get().now), home: get().home, history }),
        });
        data = await res.json().catch(() => ({ ok: false, code: 'bad_response', message: `Server answered ${res.status} with non-JSON.` }));
      } catch {
        data = { ok: false, code: 'network', message: 'Could not reach the server. Check your connection.' };
      }
      set({ busy: false });

      if (!data.ok) {
        const retry = typeof data.retryAfterSec === 'number' ? data.retryAfterSec : 0;
        if (data.code === 'rate_limited' && retry) set({ cooldownUntil: Date.now() + retry * 1000 });
        const msg = data.code === 'rate_limited'
          ? `${data.message} Try again in ${retry || 30}s.`
          : String(data.message ?? 'Something went wrong.');
        say('system', msg, { tone: 'error' });
        log('llm_error', msg, { code: data.code, raw: data.raw });
        return;
      }

      const response = data.response as AgentResponse;
      const meta = data.meta as PlanRun['meta'];
      log('llm', `${response.kind}: ${response.understanding}`, { raw: data.raw, prompt: data.prompt, meta });

      // ---- validation gate ----
      const validated = validatePlan(response.steps, get().home);
      const steps: StepRun[] = validated.map((v) => ({
        ...v,
        status: v.blocked ? 'blocked' : needsConfirmation(v) ? 'awaiting' : 'queued',
        result: v.blocked ? v.blockReason : undefined,
      }));
      const blocked = steps.filter((s) => s.blocked);
      const warnings = steps.flatMap((s) => s.warnings.map((w) => `step ${s.index + 1}: ${w}`));
      log('validation', `${steps.length} steps: ${steps.length - blocked.length} valid, ${blocked.length} blocked, ${steps.filter((s) => s.status === 'awaiting').length} need confirmation`, { warnings, notes: steps.flatMap((s) => s.notes.map((n) => `step ${s.index + 1}: ${n}`)), blocked: blocked.map((b) => b.blockReason) });
      for (const b of blocked) log('blocked', `Step ${b.index + 1} blocked: ${b.blockReason}`, b);

      const planId = uid('p');
      set((s) => ({ plans: { ...s.plans, [planId]: { id: planId, request, response, steps, meta, raw: String(data.raw ?? '') } } }));
      say('agent', response.message, { planId });
      await runQueued(planId);
    },

    confirmStep(planId, index) {
      const st = get().plans[planId]?.steps.find((s) => s.index === index);
      if (!st || st.status !== 'awaiting') return;
      log('confirm', `Resident confirmed: ${st.deviceLabel} ${st.action}`);
      set({ highlight: st.device });
      runStep(planId, st);
      setTimeout(() => set({ highlight: null }), 800);
    },

    rejectStep(planId, index) {
      const st = get().plans[planId]?.steps.find((s) => s.index === index);
      if (!st || st.status !== 'awaiting') return;
      updateStep(planId, index, { status: 'rejected', result: 'Rejected by resident' });
      log('reject', `Resident rejected: ${st.deviceLabel} ${st.action}`);
    },

    confirmAll(planId) {
      for (const st of get().plans[planId]?.steps ?? []) if (st.status === 'awaiting') get().confirmStep(planId, st.index);
    },

    advance(sim) {
      const before = get().now;
      let after = before + sim;
      // Fast-forwarding never skips past a scheduled action: stop the clock at the first one
      // that comes due, run it, and drop back to 1x so it can be seen (e.g. the door opening).
      const firstDue = Math.min(...get().tasks.map((t) => t.runAt));
      const hitsTask = firstDue <= Math.floor(after);
      if (hitsTask && firstDue > Math.floor(before)) after = firstDue;
      if (hitsTask && get().speed > 1) set({ speed: 1 });
      const whole = Math.floor(after) - Math.floor(before);
      set({ now: after });
      if (whole <= 0) return;

      // device timers + safety auto-offs
      const { home, events } = tickHome(get().home, whole);
      set({ home });
      for (const e of events) {
        log(e.message.includes('safety') ? 'safety' : 'event', e.message, { device: e.device });
        say('system', e.message, { tone: e.message.includes('safety') ? 'warn' : 'info' });
      }

      // scheduled tasks
      const due = get().tasks.filter((t) => t.runAt <= Math.floor(after)).sort((a, b) => a.runAt - b.runAt);
      if (!due.length) return;
      let tasks = get().tasks.filter((t) => !due.includes(t));
      for (const t of due) {
        const res = applyStep(get().home, t.step);
        set({ home: res.home, highlight: t.step.device });
        const when = formatClock(t.runAt);
        log('scheduled_run', `${when} ${t.step.deviceLabel}: ${res.message}`, { device: t.step.device });
        say('system', `Scheduled (${when}): ${t.step.deviceLabel}: ${res.message}`, { tone: 'info' });
        const n = t.step.schedule ? nextRun(t.step.schedule, t.runAt) : null;
        if (n !== null) tasks = [...tasks, { ...t, runAt: n }];
        updateStep(t.planId, t.stepIndex, {
          status: n !== null ? 'scheduled' : res.ok ? 'done' : 'failed',
          result: n !== null ? `ran ${when}; next ${formatClock(n)}` : `ran ${when}: ${res.message}`,
        });
      }
      set({ tasks });
      setTimeout(() => set({ highlight: null }), 900);
    },

    setSpeed(s) {
      set({ speed: s });
    },
    setHighlight(id) {
      set({ highlight: id });
    },
    resetHome() {
      set({ home: initialHome(), now: START_MINUTES, tasks: [], plans: {}, chat: [] });
      log('system', 'Home reset to defaults.');
    },
    clearLog() {
      set({ log: [] });
      saveLog([]);
    },
  };
});

// handy for debugging / scripted demo screenshots in dev only
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;
