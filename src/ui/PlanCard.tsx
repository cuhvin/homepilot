import { useState } from 'react';
import { Check, X, ChevronDown, TriangleExclamationPoint } from 'lucide-react';
import { useStore, type StepRun } from '../store';
import { describeSchedule } from '../agent/executor';

export function summarizeStep(s: StepRun): string {
  const p = s.params;
  const parts: string[] = [];
  if (p.on !== undefined) parts.push(p.on ? 'on' : 'off');
  if (p.brightness !== undefined) parts.push(`${p.brightness}%`);
  if (p.color) parts.push(p.color);
  if (p.position !== undefined) parts.push(`${p.position}% open`);
  if (p.input) parts.push(p.input);
  if (p.playlist) parts.push(`"${p.playlist}"`);
  if (p.volume !== undefined) parts.push(`vol ${p.volume}`);
  if (p.mode) parts.push(p.mode);
  if (p.target !== undefined) parts.push(`${p.target}°F`);
  if (p.temp !== undefined) parts.push(`${p.temp}°F`);
  if (p.timer_min !== undefined) parts.push(`auto-off ${p.timer_min}m`);
  if (p.minutes !== undefined) parts.push(`${p.minutes} min`);
  const action = s.action === 'set' ? '' : s.action;
  return [action, parts.join(', ')].filter(Boolean).join(' · ');
}

const STATUS_LABEL: Record<StepRun['status'], string> = {
  queued: 'queued',
  awaiting: 'needs OK',
  done: 'done',
  scheduled: 'scheduled',
  rejected: 'rejected',
  blocked: 'blocked',
  failed: 'failed',
};

export function PlanCard({ planId }: { planId: string }) {
  const plan = useStore((s) => s.plans[planId]);
  const confirmStep = useStore((s) => s.confirmStep);
  const rejectStep = useStore((s) => s.rejectStep);
  const confirmAll = useStore((s) => s.confirmAll);
  const [open, setOpen] = useState(false);
  if (!plan) return null;
  const { response, steps, meta } = plan;
  const awaiting = steps.filter((s) => s.status === 'awaiting').length;

  return (
    <div className={`plan plan--${response.kind}`}>
      <div className="plan__head">
        <span className={`kind kind--${response.kind}`}>{response.kind === 'plan' ? `Plan · ${steps.length} step${steps.length === 1 ? '' : 's'}` : response.kind === 'clarify' ? 'Needs clarification' : 'Out of scope'}</span>
        <span className="plan__goal">{response.understanding}</span>
      </div>

      {steps.length > 0 && (
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.index} className={`step step--${s.status}`}>
              <div className="step__main">
                <span className={`risk risk--${s.risk}`} title={`${s.risk} action`}>{s.risk}</span>
                <div className="step__text">
                  <strong>{s.deviceLabel}</strong>
                  <span className="step__what">{summarizeStep(s)}{s.schedule ? ` · ${describeSchedule(s.schedule)}` : ''}</span>
                  {s.reason && <span className="step__why">{s.reason}</span>}
                  {s.warnings.map((w) => <span key={w} className="step__warn"><TriangleExclamationPoint size={11} /> {w}</span>)}
                  {s.result && s.status !== 'awaiting' && s.status !== 'done' && <span className={`step__result ${s.status === 'blocked' || s.status === 'failed' ? 'is-bad' : ''}`}>{s.result}</span>}
                </div>
                <span className={`status status--${s.status}`}>{STATUS_LABEL[s.status]}</span>
              </div>
              {s.status === 'awaiting' && (
                <div className="step__confirm">
                  <span>Security-sensitive. Allow it?</span>
                  <button className="btn btn--ok" onClick={() => confirmStep(planId, s.index)}><Check size={14} /> Allow</button>
                  <button className="btn btn--no" onClick={() => rejectStep(planId, s.index)}><X size={14} /> Deny</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {awaiting > 1 && (
        <button className="btn btn--ok btn--wide" onClick={() => confirmAll(planId)}><Check size={14} /> Allow all {awaiting} sensitive steps</button>
      )}

      <button className="plan__more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> Self-check & raw output
      </button>
      {open && (
        <div className="plan__details">
          <h4>Agent self-check</h4>
          <ul>{response.checks.map((c) => <li key={c}>{c}</li>)}</ul>
          {meta && <p className="meta">{meta.model} · {meta.latencyMs} ms · {meta.attempts} attempt{meta.attempts === 1 ? '' : 's'}{meta.repaired ? ' · auto-repaired JSON' : ''}</p>}
          <h4>Raw LLM JSON</h4>
          <pre>{prettyJson(plan.raw)}</pre>
        </div>
      )}
    </div>
  );
}

function prettyJson(raw?: string) {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
