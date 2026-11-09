// Vercel serverless function: POST /api/plan
// Browser -> (request + home state) -> Gemini -> JSON plan -> browser.
// The API key never leaves the server.

import { buildUserPrompt } from '../src/agent/prompts.js';
import { planWithGemini, DEFAULT_MODEL, DEFAULT_FALLBACK, type LlmResult } from '../src/agent/llm.js';
import { mockPlan } from '../src/agent/mock.js';
import { parseAgentResponse } from '../src/agent/schema.js';
import { DEVICE_BY_ID } from '../src/home/devices.js';
import { homeForPrompt, describeDevice, type HomeState } from '../src/home/state.js';

const PER_MINUTE = 10;
const PER_DAY = 120;
const hits = new Map<string, number[]>(); // best-effort, per server instance

export async function GET(): Promise<Response> {
  return json(200, {
    ok: true,
    model: process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL ?? DEFAULT_FALLBACK,
    mock: process.env.MOCK_LLM === '1',
    keyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
}

export async function POST(req: Request): Promise<Response> {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const limited = rateLimit(ip);
  if (limited) return json(429, { ok: false, code: 'rate_limited', message: limited.message, retryAfterSec: limited.retryAfterSec });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, code: 'bad_request', message: 'Body must be JSON.' });
  }
  const request = typeof body.request === 'string' ? body.request.trim() : '';
  if (!request || request.length > 500) {
    return json(400, { ok: false, code: 'bad_request', message: 'Request must be 1-500 characters.' });
  }
  const time = typeof body.time === 'string' ? body.time.slice(0, 20) : 'unknown';
  const home = sanitizeHome(body.home);
  const history = Array.isArray(body.history)
    ? body.history
        .filter((h): h is { role: 'user' | 'agent'; text: string } =>
          typeof h === 'object' && h !== null && (h.role === 'user' || h.role === 'agent') && typeof h.text === 'string')
        .slice(-6)
        .map((h) => ({ role: h.role, text: h.text.slice(0, 300) }))
    : [];

  const userPrompt = buildUserPrompt({ request, time, homeState: homeForPrompt(home), history });

  let result: LlmResult;
  if (process.env.MOCK_LLM === '1') {
    const raw = mockPlan(request);
    const parsed = parseAgentResponse(raw);
    result = parsed.ok
      ? { ok: true, response: parsed.value, raw, model: 'mock', attempts: 1, repaired: false, latencyMs: 300 }
      : { ok: false, status: 500, code: 'bad_output', message: parsed.error, attempts: 1 };
    await new Promise((r) => setTimeout(r, 300));
  } else {
    result = await planWithGemini(userPrompt);
  }

  // Server-side audit line (visible in Vercel's function logs). No raw IP stored.
  console.log(JSON.stringify({
    t: new Date().toISOString(),
    who: hash(ip),
    request: request.slice(0, 120),
    ok: result.ok,
    ...(result.ok
      ? { kind: result.response.kind, steps: result.response.steps.length, model: result.model, attempts: result.attempts, repaired: result.repaired, ms: result.latencyMs }
      : { code: result.code, attempts: result.attempts }),
  }));

  if (!result.ok) {
    return json(result.status, { ok: false, code: result.code, message: result.message, retryAfterSec: result.retryAfterSec, raw: result.raw });
  }
  return json(200, { ok: true, response: result.response, raw: result.raw, prompt: userPrompt, meta: { model: result.model, attempts: result.attempts, repaired: result.repaired, latencyMs: result.latencyMs } });
}

function sanitizeHome(input: unknown): HomeState {
  const out: HomeState = {};
  if (typeof input !== 'object' || input === null) return out;
  for (const [id, s] of Object.entries(input as Record<string, unknown>)) {
    const info = DEVICE_BY_ID[id];
    if (!info || typeof s !== 'object' || s === null || (s as { kind?: string }).kind !== info.kind) continue;
    try {
      describeDevice(s as HomeState[string]);
      out[id] = s as HomeState[string];
    } catch {
      /* skip malformed device */
    }
  }
  return out;
}

function rateLimit(ip: string): { message: string; retryAfterSec: number } | null {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 86_400_000);
  const lastMinute = list.filter((t) => now - t < 60_000);
  if (lastMinute.length >= PER_MINUTE) {
    return { message: `Slow down: max ${PER_MINUTE} requests per minute.`, retryAfterSec: Math.ceil((60_000 - (now - lastMinute[0])) / 1000) };
  }
  if (list.length >= PER_DAY) return { message: `Daily demo limit of ${PER_DAY} requests reached.`, retryAfterSec: 3600 };
  list.push(now);
  hits.set(ip, list);
  return null;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
