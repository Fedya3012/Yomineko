import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDatabase, type DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import { recordSession } from '../progress/store';
import { loadSettings as loadProgressSettings } from '../progress/store';
import { loadSettings as loadSrsSettings } from '../srs/store';
import { grantConsent } from '../assistant/assistant';
import { DEFAULT_ASSISTANT, saveApiKey, saveAssistantSettings } from '../assistant/store';
import { applySuggestions, createRoadmap, isSkipped, loadAnswers, loadLessons, loadLive, loadRoadmap, loadSignals, loadTicks, setSkipped, setTick } from './store';
import { DEFAULT_ANSWERS } from './types';

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`roadmap-test-${n++}`); });
const now = new Date('2026-10-28T10:00:00');
const offline = { ai: { online: () => false } };

describe('createRoadmap', () => {
  it('works with no network and no AI: rule-based roadmap is saved with the answers', async () => {
    const fetch = vi.fn();
    const r = await createRoadmap(db, { ...DEFAULT_ANSWERS, minutesPerDay: 20 }, { now, ai: { fetch, online: () => false } });
    expect(fetch).not.toHaveBeenCalled();
    expect(r.source).toBe('rules');
    expect(await loadRoadmap(db)).toEqual(r);
    expect((await loadAnswers(db))?.minutesPerDay).toBe(20);
  });
  it('uses AI text only when AI is on, consented and online, and keeps the schedule', async () => {
    const asst = grantConsent({ ...DEFAULT_ASSISTANT, useAi: true, provider: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'm' } });
    await saveAssistantSettings(db, asst);
    await saveApiKey(db, 'sk-test');
    const plain = await createRoadmap(db, DEFAULT_ANSWERS, { now, useAi: false });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ content: [{ text: '{"summary":"Cố lên nhé!","tips":["Học mỗi ngày"]}' }] }), { status: 200 }));
    const ai = await createRoadmap(db, DEFAULT_ANSWERS, { now, ai: { fetch, online: () => true } });
    expect(ai.source).toBe('ai');
    expect(ai.summary).toBe('Cố lên nhé!');
    expect(ai.week).toEqual(plain.week);
    expect(ai.stages).toEqual(plain.stages);
  });
  it('falls back to the rule-based roadmap when the AI call fails', async () => {
    await saveAssistantSettings(db, grantConsent({ ...DEFAULT_ASSISTANT, useAi: true, provider: { kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'm' } }));
    await saveApiKey(db, 'sk-test');
    const fetch = vi.fn(async () => { throw new Error('mạng đứt'); });
    const r = await createRoadmap(db, DEFAULT_ANSWERS, { now, ai: { fetch, online: () => true } });
    expect(r.source).toBe('rules');
    expect(r.notice).toContain('dùng lộ trình theo luật');
    expect(r.week.some((d) => d.tasks.length)).toBe(true);
  });
  it('keeps progress when regenerating with the same start level, resets it when the start level changes', async () => {
    await recordSession(db, { endedAt: now.getTime(), seconds: 600, items: [{ kind: 'word', id: 'a', label: 'a', correct: true, learned: true }] });
    const first = await createRoadmap(db, DEFAULT_ANSWERS, { now, ...offline });
    expect(first.baseline.word).toBe(1);
    await recordSession(db, { endedAt: now.getTime() + 1000, seconds: 600, items: [{ kind: 'word', id: 'b', label: 'b', correct: true, learned: true }] });
    expect((await createRoadmap(db, { ...DEFAULT_ANSWERS, minutesPerDay: 30 }, { now, ...offline })).baseline.word).toBe(1);
    expect((await createRoadmap(db, { ...DEFAULT_ANSWERS, level: 'N5' }, { now, ...offline })).baseline.word).toBe(2);
  });
  it('clears the skipped flag', async () => {
    await setSkipped(db, true);
    expect(await isSkipped(db)).toBe(true);
    await createRoadmap(db, DEFAULT_ANSWERS, { now, ...offline });
    expect(await isSkipped(db)).toBe(false);
  });
});

describe('links to the rest of the app', () => {
  it('reads installed lessons and links them from lesson tasks', async () => {
    await installPack(db, {
      manifest: { format: 1, id: 'lessons-test', kind: 'deck', title: 'Lessons', version: 1, license: { name: 'CC0', url: 'https://x.test' } },
      upserts: { textbooks: [{ id: 'mnn1', title: 'Minna 1', level: 'N5', lessonIds: ['l1', 'l2'] }], 'tb-lessons': [{ id: 'l2', textbookId: 'mnn1', title: 'Bài 2', order: 2 }, { id: 'l1', textbookId: 'mnn1', title: 'Bài 1', order: 1 }] }
    } as never);
    expect((await loadLessons(db)).map((l) => [l.id, l.level, l.book]).sort()).toEqual([['l1', 'N5', 'minna'], ['l2', 'N5', 'minna']]);
    const r = await createRoadmap(db, { ...DEFAULT_ANSWERS, style: 'textbook', minutesPerDay: 45 }, { now, ...offline });
    expect(r.week.flatMap((d) => d.tasks).find((t) => t.kind === 'lesson')?.lessonId).toBe('l1');
  });
  it('applySuggestions writes the SRS and daily-goal settings only when asked', async () => {
    const r = await createRoadmap(db, { ...DEFAULT_ANSWERS, minutesPerDay: 30 }, { now, ...offline });
    expect((await loadSrsSettings(db)).newPerDay).not.toBe(r.suggest.srsNewPerDay);
    await applySuggestions(db, r);
    expect((await loadSrsSettings(db)).newPerDay).toBe(r.suggest.srsNewPerDay);
    expect((await loadProgressSettings(db)).goal).toEqual({ unit: 'minutes', target: 30 });
  });
  it('signals reflect recent study and are undefined without history', async () => {
    expect((await loadSignals(db, now)).avgMinutes14).toBeUndefined();
    await recordSession(db, { endedAt: now.getTime(), seconds: 1400, items: [{ kind: 'word', id: 'x', label: 'x', correct: true }] });
    expect((await loadSignals(db, now)).avgMinutes14).toBeCloseTo(1400 / 60 / 14, 5);
  });
  it('ticks are remembered per day and loadLive reports today', async () => {
    await setTick(db, '2026-10-28', '2:1:kanji', true);
    await setTick(db, '2026-10-28', '2:2:grammar', true);
    await setTick(db, '2026-10-28', '2:1:kanji', false);
    expect([...(await loadTicks(db, '2026-10-28'))]).toEqual(['2:2:grammar']);
    expect((await loadTicks(db, '2026-10-29')).size).toBe(0);
    const live = await loadLive(db, now);
    expect(live).toMatchObject({ today: '2026-10-28', srsReviewed: 0 });
    expect(live.ticks.has('2:2:grammar')).toBe(true);
  });
});
