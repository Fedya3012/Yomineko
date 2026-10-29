import { describe, it, expect, vi } from 'vitest';
import { aiBlockedReason, grantConsent, hasConsent, respond, MAX_SENT_TURNS } from './assistant';
import { buildSystemPrompt, callAi } from './ai';
import { DEFAULT_ASSISTANT } from './store';
import type { AssistantSettings } from './types';

const anthropic: AssistantSettings['provider'] = { kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5' };
const aiOn = (extra: Partial<AssistantSettings> = {}): AssistantSettings => ({ ...DEFAULT_ASSISTANT, useAi: true, provider: anthropic, ...extra });
const okFetch = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
const base = { mode: 'chat' as const, text: 'こんにちは', history: [], apiKey: 'sk-test' };

describe('privacy defaults', () => {
  it('AI is off and has no consent on a fresh install', () => {
    expect(DEFAULT_ASSISTANT.useAi).toBe(false);
    expect(hasConsent(DEFAULT_ASSISTANT)).toBe(false);
  });
  it('never calls the network without consent, even with a key and internet', async () => {
    const fetch = okFetch({});
    const r = await respond({ ...base, settings: aiOn() }, { fetch, online: () => true });
    expect(fetch).not.toHaveBeenCalled();
    expect(r.source).toBe('offline');
    expect(r.notice).toContain('đồng ý');
  });
  it('never calls the network when AI is switched off, even with consent', async () => {
    const fetch = okFetch({});
    const s = grantConsent(aiOn({ useAi: false }));
    await respond({ ...base, settings: s }, { fetch, online: () => true });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('consent is void if the endpoint changes', () => {
    const s = grantConsent(aiOn());
    expect(hasConsent(s)).toBe(true);
    expect(hasConsent({ ...s, provider: { ...anthropic, baseUrl: 'https://evil.example.com' } })).toBe(false);
  });
});

describe('fallback to offline', () => {
  const consented = grantConsent(aiOn());
  it('uses offline when there is no internet', async () => {
    const fetch = okFetch({});
    const r = await respond({ ...base, settings: consented }, { fetch, online: () => false });
    expect(fetch).not.toHaveBeenCalled();
    expect(r.source).toBe('offline');
  });
  it('needs an API key for remote services', () => {
    expect(aiBlockedReason(consented, '', true)).toContain('khoá');
  });
  it('does not need a key for a local server', () => {
    const local = grantConsent(aiOn({ provider: { kind: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', model: 'm' } }));
    expect(aiBlockedReason(local, '', true)).toBeNull();
  });
  it('falls back with a notice when the request fails', async () => {
    const fetch = vi.fn(async () => { throw new Error('network'); });
    const r = await respond({ ...base, settings: consented }, { fetch, online: () => true });
    expect(r.source).toBe('offline');
    expect(r.notice).toContain('offline');
  });
  it('falls back on HTTP errors', async () => {
    const fetch = vi.fn(async () => new Response('no', { status: 401 }));
    const r = await respond({ ...base, settings: consented }, { fetch, online: () => true });
    expect(r.source).toBe('offline');
    expect(r.notice).toContain('401');
  });
});

describe('AI path', () => {
  it('returns the AI answer and sends only persona, level and recent turns', async () => {
    const fetch = okFetch({ content: [{ text: 'やあ！' }] });
    const s = grantConsent(aiOn({ level: 'N4', customName: 'Neko' }));
    const history = Array.from({ length: 20 }, (_, i) => ({ role: 'user' as const, text: `m${i}` }));
    const r = await respond({ ...base, history, settings: s }, { fetch, online: () => true });
    expect(r.source).toBe('ai');
    expect(r.text).toBe('やあ！');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const body = JSON.parse(init.body as string);
    expect(body.messages).toHaveLength(MAX_SENT_TURNS);
    expect(body.system).toContain('Neko');
    expect(body.system).toContain('N4');
    expect(JSON.stringify(body)).not.toContain('sk-test');
  });
  it('speaks the OpenAI-compatible format too', async () => {
    const fetch = okFetch({ choices: [{ message: { content: 'ok' } }] });
    const p = { kind: 'openai-compatible' as const, baseUrl: 'http://localhost:11434/v1/', model: 'm' };
    const out = await callAi(p, '', 'sys', [{ role: 'user', text: 'hi' }], fetch);
    expect(out).toBe('ok');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    expect(JSON.parse(init.body as string).messages[0]).toEqual({ role: 'system', content: 'sys' });
  });
  it('builds a role-play system prompt with the scenario', () => {
    const p = buildSystemPrompt(aiOn(), 'roleplay', { scenarioId: 'konbini', step: 0, done: false });
    expect(p).toContain('cửa hàng tiện lợi');
  });
});
