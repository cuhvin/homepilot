// The JSON contract between the LLM and the Actor.
// RESPONSE_JSON_SCHEMA is sent to Gemini as `responseJsonSchema` (structured output),
// and parseAgentResponse() re-checks the shape because we never trust LLM output blindly.

export type ResponseKind = 'plan' | 'clarify' | 'refuse';
export type Repeat = 'once' | 'daily' | 'weekdays';

export interface StepParams {
  on?: boolean;
  brightness?: number;
  color?: string;
  position?: number;
  volume?: number;
  input?: string;
  playlist?: string;
  target?: number;
  mode?: string;
  temp?: number;
  timer_min?: number;
  minutes?: number;
}

export interface StepSchedule {
  at?: string; // "HH:MM" 24h simulated time
  in_minutes?: number;
  repeat?: Repeat;
}

export interface PlanStep {
  device: string;
  action: string;
  params: StepParams;
  reason: string;
  schedule?: StepSchedule;
}

export interface AgentResponse {
  kind: ResponseKind;
  understanding: string; // restated goal (plan-then-act)
  steps: PlanStep[];
  checks: string[]; // self-check notes written after planning
  message: string; // friendly reply shown to the user
}

export const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['plan', 'clarify', 'refuse'] },
    understanding: { type: 'string', description: "One sentence restating the user's goal in your own words." },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          device: { type: 'string', description: 'Exact device id from the device list.' },
          action: { type: 'string' },
          params: {
            type: 'object',
            properties: {
              on: { type: 'boolean' },
              brightness: { type: 'integer' },
              color: { type: 'string' },
              position: { type: 'integer' },
              volume: { type: 'integer' },
              input: { type: 'string' },
              playlist: { type: 'string' },
              target: { type: 'number' },
              mode: { type: 'string' },
              temp: { type: 'integer' },
              timer_min: { type: 'integer' },
              minutes: { type: 'integer' },
            },
          },
          reason: { type: 'string', description: 'Why this step serves the goal (max 12 words).' },
          schedule: {
            type: 'object',
            properties: {
              at: { type: 'string', description: 'HH:MM, 24-hour.' },
              in_minutes: { type: 'integer' },
              repeat: { type: 'string', enum: ['once', 'daily', 'weekdays'] },
            },
          },
        },
        required: ['device', 'action', 'params', 'reason'],
      },
    },
    checks: { type: 'array', items: { type: 'string' }, description: 'Self-check notes on safety, conflicts and assumptions.' },
    message: { type: 'string', description: 'Short, friendly reply to the user.' },
  },
  required: ['kind', 'understanding', 'steps', 'checks', 'message'],
} as const;

export type ParseResult = { ok: true; value: AgentResponse } | { ok: false; error: string };

/** Parse raw LLM text into an AgentResponse, or explain exactly what is wrong. */
export function parseAgentResponse(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch (e) {
    return { ok: false, error: `Output is not valid JSON (${(e as Error).message}).` };
  }
  if (!isObj(data)) return { ok: false, error: 'Top level must be a JSON object.' };
  const { kind, understanding, steps, checks, message } = data;
  if (kind !== 'plan' && kind !== 'clarify' && kind !== 'refuse') {
    return { ok: false, error: `"kind" must be plan, clarify or refuse (got ${JSON.stringify(kind)}).` };
  }
  if (typeof message !== 'string' || !message.trim()) return { ok: false, error: '"message" must be a non-empty string.' };
  if (!Array.isArray(steps)) return { ok: false, error: '"steps" must be an array.' };
  const cleanSteps: PlanStep[] = [];
  for (const [i, s] of steps.entries()) {
    if (!isObj(s)) return { ok: false, error: `steps[${i}] must be an object.` };
    if (typeof s.device !== 'string' || typeof s.action !== 'string') {
      return { ok: false, error: `steps[${i}] needs string "device" and "action".` };
    }
    cleanSteps.push({
      device: s.device.trim(),
      action: s.action.trim().toLowerCase(),
      params: isObj(s.params) ? (s.params as StepParams) : {},
      reason: typeof s.reason === 'string' ? s.reason : '',
      schedule: isObj(s.schedule) ? (s.schedule as StepSchedule) : undefined,
    });
  }
  return {
    ok: true,
    value: {
      kind,
      understanding: typeof understanding === 'string' ? understanding : '',
      steps: kind === 'plan' ? cleanSteps : [],
      checks: Array.isArray(checks) ? checks.filter((c): c is string => typeof c === 'string') : [],
      message: message.trim(),
    },
  };
}

function stripFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
