import { describe, it, expect, vi } from 'vitest';
import { parseAiReply, refineWithAi } from './ai';
import { generateRoadmap } from './generate';
import { DEFAULT_ANSWERS } from './types';
import { DEFAULT_ASSISTANT } from '../assistant/store';
import { grantConsent } from '../assistant/assistant';

const road = generateRoadmap(DEFAULT_ANSWERS, { now: new Date('2026-10-28T10:00:00') });
const on = grantConsent({ ...DEFAULT_ASSISTANT, useAi: true, provider: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'm' } });
const reply = (text: string) => vi.fn(async () => new Response(JSON.stringify({ content: [{ text }] }), { status: 200 }));

describe('parseAiReply', () => {
  it('reads JSON even when wrapped in text, and trims lengths', () => {
    expect(parseAiReply('Đây: {"summary":" ok ","tips":["a","b","c","d"]} xong')).toEqual({ summary: 'ok', tips: ['a', 'b', 'c'] });
    expect(parseAiReply(`{"summary":"${'x'.repeat(900)}"}`)?.summary).toHaveLength(400);
  });
  it('rejects junk', () => {
    expect(parseAiReply('không có json')).toBeNull();
    expect(parseAiReply('{"summary":5,"tips":"no"}')).toBeNull();
    expect(parseAiReply('{broken')).toBeNull();
  });
});

describe('refineWithAi', () => {
  it('never touches the network while AI is off', async () => {
    const fetch = reply('{}');
    const r = await refineWithAi(road, { ...DEFAULT_ASSISTANT }, 'k', { fetch, online: () => true });
    expect(fetch).not.toHaveBeenCalled();
    expect(r).toEqual({ ...road, notice: undefined });
  });
  it('explains why it stayed offline when AI is on but there is no consent or no internet', async () => {
    const fetch = reply('{}');
    expect((await refineWithAi(road, { ...on, consent: undefined }, 'k', { fetch, online: () => true })).notice).toContain('đồng ý');
    expect((await refineWithAi(road, on, 'k', { fetch, online: () => false })).notice).toContain('Không có mạng');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('sends only the answers summary, never personal data', async () => {
    const fetch = reply('{"summary":"hi","tips":[]}');
    await refineWithAi(road, on, 'k', { fetch, online: () => true });
    const body = String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(body).toContain('phút/ngày');
    expect(body).not.toContain('sk-');
  });
  it('keeps the rule-based roadmap on bad output', async () => {
    const r = await refineWithAi(road, on, 'k', { fetch: reply('xin chào'), online: () => true });
    expect(r.source).toBe('rules');
    expect(r.summary).toBe(road.summary);
    expect(r.notice).toBeTruthy();
  });
});
