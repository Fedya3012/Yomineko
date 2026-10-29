import { describe, it, expect, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { openDatabase } from '../../lib/db';
import { recordSession } from '../progress/store';
import type { DayLog, LearnedMap } from '../progress/types';
import { DEFAULT_SETTINGS, emptyStats, type DayStats } from '../srs/types';
import { DEFAULT_ASSISTANT } from '../assistant/store';
import { grantConsent } from '../assistant/assistant';
import { applyRecommendation, recommendDifficulty } from './adaptive';
import { rewriteOffline, rewriteSummary, STYLES } from './rewrite';
import { loadBoost } from './store';
import { buildStudySummary, periodRange, shiftAnchor, summaryToMarkdown, summaryToText } from './summary';
import { analyzeWeakness, classifyItem, isRepeatedMistake, reviewBoost } from './weakness';
import { buildQueue } from '../srs/session';

const log = (date: string, items: DayLog['items'], seconds = 600): DayLog => ({
  date, seconds, sessions: 1, cards: Object.values(items).reduce((n, i) => n + i.seen, 0), items
});
const item = (kind: 'word' | 'kanji' | 'grammar', id: string, label: string, seen: number, missed: number) => [`${kind}:${id}`, { kind, id, label, seen, missed }] as const;
const learned: LearnedMap = { word: { neko: '2026-10-28' }, kanji: {}, grammar: {} };

describe('classifyItem', () => {
  it('recognises particles, conjugation and readings', () => {
    expect(classifyItem({ kind: 'grammar', id: 'wa', label: 'は (chủ đề)' })).toBe('particle');
    expect(classifyItem({ kind: 'grammar', id: 'x', label: 'を (tân ngữ)' })).toBe('particle');
    expect(classifyItem({ kind: 'grammar', id: 'te', label: 'Thể て của động từ' })).toBe('conjugation');
    expect(classifyItem({ kind: 'word', id: 'a', label: '食べる - て形' })).toBe('conjugation');
    expect(classifyItem({ kind: 'kanji', id: '生', label: '生 音読み' })).toBe('reading-on');
    expect(classifyItem({ kind: 'kanji', id: '生', label: '生 訓読み' })).toBe('reading-kun');
    expect(classifyItem({ kind: 'kanji', id: '本', label: '本' })).toBe('kanji');
    expect(classifyItem({ kind: 'word', id: 'neko', label: '猫 (ねこ)' })).toBe('vocab');
  });
  it('an explicit tag beats guessing, and an unknown tag is ignored', () => {
    expect(classifyItem({ kind: 'kanji', id: 'k', label: 'x', tag: 'reading-on' })).toBe('reading-on');
    expect(classifyItem({ kind: 'word', id: 'k', label: 'x', tag: 'nonsense' })).toBe('vocab');
  });
});

describe('analyzeWeakness', () => {
  const logs = new Map<string, DayLog>([
    ['2026-10-20', log('2026-10-20', Object.fromEntries([item('grammar', 'wa', 'は', 4, 3), item('word', 'neko', '猫', 4, 0)]))],
    ['2026-10-29', log('2026-10-29', Object.fromEntries([item('grammar', 'wa', 'は', 4, 2), item('word', 'inu', '犬', 4, 1)]))]
  ]);
  const r = analyzeWeakness(logs, '2026-10-29');
  it('puts the most frequently missed item first and groups by category', () => {
    expect(r.items[0].id).toBe('wa');
    expect(r.categories[0].category).toBe('particle');
    expect(r.categories[0].missed).toBe(5);
  });
  it('never lists items that were always correct', () => expect(r.items.find((i) => i.id === 'neko')).toBeUndefined());
  it('recent mistakes outweigh old ones', () => {
    const old = new Map([['2026-10-01', log('2026-10-01', Object.fromEntries([item('word', 'a', 'A', 4, 3)]))], ['2026-10-29', log('2026-10-29', Object.fromEntries([item('word', 'b', 'B', 4, 3)]))]]);
    expect(analyzeWeakness(old, '2026-10-29').items[0].id).toBe('b');
  });
  it('one slip is not a "repeated mistake"; only words get a review boost', () => {
    expect(isRepeatedMistake(r.items.find((i) => i.id === 'inu')!)).toBe(false);
    const boost = reviewBoost(analyzeWeakness(new Map([['2026-10-29', log('2026-10-29', Object.fromEntries([item('word', 'x', 'X', 4, 3), item('grammar', 'wa', 'は', 4, 3)]))]]), '2026-10-29'));
    expect([...boost.keys()]).toEqual(['x']);
  });
});

describe('periods', () => {
  it('week is Monday to Sunday, month is the calendar month', () => {
    expect(periodRange('week', '2026-10-29')).toMatchObject({ from: '2026-10-26', to: '2026-11-01' });
    expect(periodRange('week', '2026-11-01')).toMatchObject({ from: '2026-10-26', to: '2026-11-01' });
    expect(periodRange('month', '2026-02-10')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(periodRange('month', '2028-02-10').to).toBe('2028-02-29');
  });
  it('shifts by one period, including over year ends', () => {
    expect(shiftAnchor('day', '2026-10-29', -1)).toBe('2026-10-28');
    expect(shiftAnchor('week', '2026-10-29', 1)).toBe('2026-11-05');
    expect(shiftAnchor('month', '2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftAnchor('month', '2026-12-15', 1)).toBe('2027-01-01');
  });
});

describe('buildStudySummary', () => {
  const logs = new Map<string, DayLog>([
    ['2026-10-26', log('2026-10-26', Object.fromEntries([item('word', 'neko', '猫', 5, 0), item('grammar', 'wa', 'は', 4, 3)]), 900)],
    ['2026-10-28', log('2026-10-28', Object.fromEntries([item('word', 'neko', '猫', 3, 0), item('kanji', '本', '本', 2, 1)]), 300)],
    ['2026-09-01', log('2026-09-01', Object.fromEntries([item('word', 'old', '古', 9, 9)]), 9999)]
  ]);
  const srs = new Map<string, DayStats>([['2026-10-28', { ...emptyStats(), reviewed: 10, newCards: 2, again: 2, hard: 1, good: 6, easy: 1 }], ['2026-09-01', { ...emptyStats(), reviewed: 99 }]]);
  const s = buildStudySummary({ logs, learned, srs, period: 'week', anchor: '2026-10-29' });
  it('adds up only the days inside the period', () => {
    expect(s.seconds).toBe(1200);
    expect(s.cards).toBe(14);
    expect(s.activeDays).toBe(2);
    expect(s.touched).toEqual({ word: 1, kanji: 1, grammar: 1 });
    expect(s.newlyLearned.word).toBe(1);
    expect(s.srs).toMatchObject({ reviewed: 10, again: 2, remembered: 8 });
  });
  it('finds strengths, weaknesses and a suggestion for the next session', () => {
    expect(s.strengths.some((x) => x.includes('猫'))).toBe(true);
    expect(s.weaknesses.some((w) => w.label.includes('Trợ từ'))).toBe(true);
    expect(s.suggestions[0]).toContain('Trợ từ');
  });
  it('a different period excludes other days', () => {
    expect(buildStudySummary({ logs, learned, srs, period: 'day', anchor: '2026-10-28' }).cards).toBe(5);
    expect(buildStudySummary({ logs, learned, srs, period: 'month', anchor: '2026-09-15' }).cards).toBe(9);
  });
  it('handles an empty period', () => {
    const e = buildStudySummary({ logs, learned, srs, period: 'day', anchor: '2026-10-01' });
    expect(e.cards).toBe(0);
    expect(e.suggestions[0]).toContain('Chưa có dữ liệu');
    expect(rewriteOffline(e, 'brief')).toContain('chưa có buổi học');
  });
  it('exports text and Markdown with every section', () => {
    const md = summaryToMarkdown(s);
    for (const h of ['# Tuần', '## Tổng quan', '## Kết quả SRS', '## Điểm mạnh', '## Điểm yếu', '## Gợi ý cho buổi sau']) expect(md).toContain(h);
    expect(summaryToText(s)).toContain('Gợi ý buổi sau');
  });
  it('every style rewrites offline without losing the headline numbers', () => {
    for (const st of STYLES) expect(rewriteOffline(s, st)).toMatch(/14|đúng/);
  });
});

describe('rewriteSummary privacy', () => {
  const s = buildStudySummary({ logs: new Map([['2026-10-28', log('2026-10-28', Object.fromEntries([item('word', 'a', 'A', 3, 1)]))]]), learned, srs: new Map(), period: 'day', anchor: '2026-10-28' });
  const anthropic = { kind: 'anthropic' as const, baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5' };
  const on = { ...DEFAULT_ASSISTANT, useAi: true, provider: anthropic };
  const ok = () => vi.fn(async () => new Response(JSON.stringify({ content: [{ text: 'Bản AI' }] }), { status: 200 }));
  it('does not call the network without consent', async () => {
    const fetch = ok();
    const r = await rewriteSummary(s, 'cheerful', { settings: on, apiKey: 'k' }, { fetch, online: () => true });
    expect(fetch).not.toHaveBeenCalled();
    expect(r.source).toBe('offline');
  });
  it('does not call the network when AI is off or offline', async () => {
    const fetch = ok();
    await rewriteSummary(s, 'brief', { settings: grantConsent({ ...on, useAi: false }), apiKey: 'k' }, { fetch, online: () => true });
    await rewriteSummary(s, 'brief', { settings: grantConsent(on), apiKey: 'k' }, { fetch, online: () => false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('with consent sends only the summary text, and falls back on failure', async () => {
    const fetch = ok();
    const r = await rewriteSummary(s, 'diary', { settings: grantConsent(on), apiKey: 'k' }, { fetch, online: () => true });
    expect(r).toMatchObject({ text: 'Bản AI', source: 'ai' });
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toContain('Ngày 2026-10-28');
    const bad = vi.fn(async () => new Response('x', { status: 500 }));
    const r2 = await rewriteSummary(s, 'diary', { settings: grantConsent(on), apiKey: 'k' }, { fetch: bad, online: () => true });
    expect(r2.source).toBe('offline');
    expect(r2.notice).toContain('offline');
  });
});

describe('recommendDifficulty', () => {
  const mk = (seen: number, missed: number) => new Map([['2026-10-29', log('2026-10-29', Object.fromEntries([item('word', 'a', 'A', seen, missed)]))]]);
  const st = (again: number, reviewed: number) => new Map([['2026-10-29', { ...emptyStats(), reviewed, again }]]);
  it('keeps the level when there is too little data', () => {
    const r = recommendDifficulty(mk(5, 0), new Map(), DEFAULT_SETTINGS, '2026-10-29');
    expect(r).toMatchObject({ level: 'keep', changed: false });
  });
  it('raises difficulty when results are very good', () => {
    const r = recommendDifficulty(mk(40, 1), st(1, 40), DEFAULT_SETTINGS, '2026-10-29');
    expect(r.level).toBe('harder');
    expect(r.newPerDay).toBe(DEFAULT_SETTINGS.newPerDay + 2);
  });
  it('lowers difficulty when results are poor, within bounds', () => {
    const r = recommendDifficulty(mk(40, 20), st(14, 40), { ...DEFAULT_SETTINGS, newPerDay: 4 }, '2026-10-29');
    expect(r.level).toBe('easier');
    expect(r.newPerDay).toBe(3);
    expect(r.retention).toBeCloseTo(0.92);
    expect(applyRecommendation(DEFAULT_SETTINGS, r)).toMatchObject({ newPerDay: 3, types: DEFAULT_SETTINGS.types });
  });
  it('keeps a comfortable middle and respects the upper bound', () => {
    expect(recommendDifficulty(mk(40, 8), st(4, 40), DEFAULT_SETTINGS, '2026-10-29').level).toBe('keep');
    expect(recommendDifficulty(mk(40, 0), st(0, 40), { ...DEFAULT_SETTINGS, newPerDay: 30 }, '2026-10-29').changed).toBe(false);
  });
  it('ignores results older than the window', () => {
    const old = new Map([['2026-10-01', log('2026-10-01', Object.fromEntries([item('word', 'a', 'A', 50, 40)]))]]);
    expect(recommendDifficulty(old, new Map(), DEFAULT_SETTINGS, '2026-10-29').level).toBe('keep');
  });
});

describe('review priority end to end', () => {
  it('words missed repeatedly are asked first in the SRS queue', async () => {
    const db = await openDatabase(`t-${Math.random()}`);
    const day = new Date('2026-10-29T10:00:00').getTime();
    for (let i = 0; i < 3; i++) await recordSession(db, { endedAt: day, seconds: 60, items: [{ kind: 'word', id: 'b', label: 'B', correct: false }, { kind: 'word', id: 'a', label: 'A', correct: true }] });
    const boost = await loadBoost(db, day);
    expect(boost.has('b')).toBe(true);
    const mkState = (cardId: string, due: number) => ({ cardId, due } as never);
    const states = new Map([['a', mkState('a', 1)], ['b', mkState('b', 2)]]);
    const cards = ['a', 'b'].map((id) => ({ id, word: id, reading: id, meaning: id }));
    const base = { cards, states, settings: { ...DEFAULT_SETTINGS, newPerDay: 0 }, stats: emptyStats(), now: 10 };
    expect(buildQueue(base)).toEqual(['a', 'b']);
    expect(buildQueue({ ...base, boost })).toEqual(['b', 'a']);
  });
  it('stores the explicit tag given by a feature', async () => {
    const db = await openDatabase(`t-${Math.random()}`);
    const t = new Date('2026-10-29T10:00:00').getTime();
    await recordSession(db, { endedAt: t, seconds: 10, items: [{ kind: 'kanji', id: '生', label: '生', correct: false, tag: 'reading-kun' }] });
    const { loadLogs } = await import('../progress/store');
    expect(analyzeWeakness(await loadLogs(db), '2026-10-29').categories[0].category).toBe('reading-kun');
  });
});
