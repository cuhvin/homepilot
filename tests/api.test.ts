import { afterEach, describe, expect, it } from 'vitest';
import { POST, GET } from '../api/plan.ts';
import { initialHome } from '../src/home/state.ts';

const req = (body: unknown, ip = '1.2.3.4') =>
  new Request('http://x/api/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

afterEach(() => {
  delete process.env.MOCK_LLM;
});

describe('/api/plan', () => {
  it('reports health without leaking the key', async () => {
    const res = await GET();
    const data = (await res.json()) as any; // eslint-disable-line
    expect(data.ok).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/AIza/);
  });

  it('rejects non-JSON bodies', async () => {
    const res = await POST(req('not json', '10.0.0.1'));
    expect(res.status).toBe(400);
  });

  it('rejects empty and oversized requests', async () => {
    expect((await POST(req({ request: '' }, '10.0.0.2'))).status).toBe(400);
    expect((await POST(req({ request: 'x'.repeat(600) }, '10.0.0.2'))).status).toBe(400);
  });

  it('fails gracefully when the API key is missing', async () => {
    const saved = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const res = await POST(req({ request: 'movie night', home: initialHome() }, '10.0.0.3'));
    const data = (await res.json()) as any; // eslint-disable-line
    expect(res.status).toBe(500);
    expect(data.code).toBe('config_error');
    if (saved) process.env.GEMINI_API_KEY = saved;
  });

  it('returns a parsed plan in mock mode', async () => {
    process.env.MOCK_LLM = '1';
    const res = await POST(req({ request: 'movie night', home: initialHome(), time: 'Fri 20:00' }, '10.0.0.4'));
    const data = (await res.json()) as any; // eslint-disable-line
    expect(data.ok).toBe(true);
    expect(data.response.kind).toBe('plan');
    expect(data.prompt).toMatch(/CURRENT HOME STATE/);
  });

  it('rate-limits a single client', async () => {
    process.env.MOCK_LLM = '1';
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await POST(req({ request: 'turn it up' }, '10.0.0.5'))).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
  }, 15000);
});
