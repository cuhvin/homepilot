// LLM integration module (server-side only: it reads the API key).
// - Gemini structured output (JSON schema)
// - retries with exponential backoff + jitter on 429 / 5xx / timeouts
// - honors the server's suggested retry delay, gives up early if it is long
// - one "repair" round-trip when the output fails to parse
// - falls back to a second free-tier model when the first one is rate-limited

import { GoogleGenAI, ApiError, ThinkingLevel } from '@google/genai';
import { SYSTEM_PROMPT, repairPrompt } from './prompts.js';
import { RESPONSE_JSON_SCHEMA, parseAgentResponse, type AgentResponse } from './schema.js';

export interface LlmSuccess {
  ok: true;
  response: AgentResponse;
  raw: string;
  model: string;
  attempts: number;
  repaired: boolean;
  latencyMs: number;
}

export interface LlmFailure {
  ok: false;
  status: number; // HTTP status we return to the browser
  code: 'rate_limited' | 'upstream_error' | 'timeout' | 'bad_output' | 'config_error' | 'blocked';
  message: string;
  retryAfterSec?: number;
  raw?: string;
  attempts: number;
}

export type LlmResult = LlmSuccess | LlmFailure;

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 25_000;
const MAX_INLINE_WAIT_SEC = 8; // longer suggested waits are returned to the user instead

type Content = { role: 'user' | 'model'; parts: { text: string }[] };

const THINKING: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_FALLBACK = 'gemini-3.1-flash-lite';

export async function planWithGemini(userPrompt: string, opts: { apiKey?: string; model?: string; fallback?: string } = {}): Promise<LlmResult> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  let model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const fallback = opts.fallback ?? process.env.GEMINI_FALLBACK_MODEL ?? DEFAULT_FALLBACK;
  if (!apiKey) {
    return { ok: false, status: 500, code: 'config_error', message: 'Server is missing GEMINI_API_KEY.', attempts: 0 };
  }
  const ai = new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 1 } } });
  const started = Date.now();
  let attempts = 0;

  const call = async (contents: Content[]): Promise<{ text: string } | LlmFailure> => {
    for (;;) {
      attempts++;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            responseJsonSchema: RESPONSE_JSON_SCHEMA,
            temperature: 0.2,
            // planning a few device steps doesn't need deep reasoning; LOW keeps replies fast
            thinkingConfig: { thinkingLevel: THINKING[(process.env.GEMINI_THINKING ?? 'low').toLowerCase()] ?? ThinkingLevel.LOW },
            maxOutputTokens: 2048,
            abortSignal: ctrl.signal,
          },
        });
        const text = res.text ?? '';
        if (!text.trim()) {
          const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? 'empty';
          return { ok: false, status: 502, code: 'blocked', message: `The model returned no answer (${reason}).`, attempts };
        }
        return { text };
      } catch (err) {
        const status = err instanceof ApiError ? err.status : ctrl.signal.aborted ? 408 : 0;
        const retryable = status === 408 || status === 429 || status >= 500 || status === 0;
        const suggested = parseRetryDelay(err);
        if (!retryable || attempts >= MAX_ATTEMPTS || (suggested ?? 0) > MAX_INLINE_WAIT_SEC) {
          return toFailure(err, status, suggested, attempts);
        }
        const backoff = suggested ? suggested * 1000 : 800 * 2 ** (attempts - 1) + Math.random() * 400;
        console.warn(`[llm] ${model} attempt ${attempts} failed (${status || 'network'}): ${(err as Error).message?.slice(0, 120)}; retrying in ${Math.round(backoff)} ms`);
        await sleep(backoff);
      } finally {
        clearTimeout(timer);
      }
    }
  };

  // Each free-tier model has its own quota: if the primary is rate-limited, try the fallback once.
  const callWithFallback = async (c: Content[]) => {
    const r = await call(c);
    if ('ok' in r && r.code === 'rate_limited' && fallback && fallback !== model) {
      console.warn(`[llm] ${model} rate-limited, falling back to ${fallback}`);
      model = fallback;
      return call(c);
    }
    return r;
  };

  const contents: Content[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
  const first = await callWithFallback(contents);
  if ('ok' in first) return first;

  let raw = first.text;
  let parsed = parseAgentResponse(raw);
  let repaired = false;
  if (!parsed.ok) {
    // Error-feedback repair: show the model its own output and what was wrong, once.
    const second = await callWithFallback([
      ...contents,
      { role: 'model', parts: [{ text: raw }] },
      { role: 'user', parts: [{ text: repairPrompt(raw, parsed.error) }] },
    ]);
    if ('ok' in second) return second;
    raw = second.text;
    parsed = parseAgentResponse(raw);
    repaired = true;
    if (!parsed.ok) {
      return { ok: false, status: 502, code: 'bad_output', message: `Model output was unusable: ${parsed.error}`, raw, attempts };
    }
  }
  return { ok: true, response: parsed.value, raw, model, attempts, repaired, latencyMs: Date.now() - started };
}

function toFailure(err: unknown, status: number, retryAfter: number | undefined, attempts: number): LlmFailure {
  const msg = err instanceof Error ? err.message : String(err);
  if (status === 429) {
    return {
      ok: false, status: 429, code: 'rate_limited', attempts,
      retryAfterSec: Math.ceil(retryAfter ?? 30),
      message: 'Gemini free-tier limit reached.',
    };
  }
  if (status === 408) return { ok: false, status: 504, code: 'timeout', message: 'The model took too long to answer.', attempts };
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return { ok: false, status: 500, code: 'config_error', message: `Gemini rejected the request (${status}): ${msg.slice(0, 200)}`, attempts };
  }
  return { ok: false, status: 502, code: 'upstream_error', message: `Gemini error${status ? ` ${status}` : ''}: ${msg.slice(0, 200)}`, attempts };
}

function parseRetryDelay(err: unknown): number | undefined {
  const msg = err instanceof Error ? err.message : '';
  const m = /retry(?:Delay)?"?\s*[:=]?\s*"?(\d+(?:\.\d+)?)s/i.exec(msg) ?? /retry in (\d+(?:\.\d+)?)\s*s/i.exec(msg);
  return m ? Number(m[1]) : undefined;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
