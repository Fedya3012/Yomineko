import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, listCollection, type DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import { loadOverview, loadSettings, recordSession, saveSettings } from './store';
import { summaryToMarkdown, summaryToText } from './summary';
import type { SessionInput } from './types';

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`progress-test-${n++}`); });

const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
const session = (iso: string, over: Partial<SessionInput> = {}): SessionInput => ({
  endedAt: at(iso), seconds: 600, source: 'SRS',
  items: [
    { kind: 'word', id: 'neko', label: '猫', correct: true, learned: true },
    { kind: 'kanji', id: '犬', label: '犬', correct: false }
  ], ...over
});

describe('recordSession', () => {
  it('stores the day, counts learned items once, and builds a summary', async () => {
    const first = await recordSession(db, session('2026-10-28'));
    expect(first).toMatchObject({ date: '2026-10-28', minutes: 10, cards: 2, correct: 1, accuracy: 0.5 });
    expect(first.newlyLearned).toEqual({ word: 1, kanji: 0, grammar: 0 });
    expect(first.weak).toEqual([{ label: '犬', misses: 1 }]);

    // Same word "learned" again must not be double counted.
    const second = await recordSession(db, session('2026-10-29'));
    expect(second.newlyLearned.word).toBe(0);
    expect(second.streak).toBe(2);

    const o = await loadOverview(db, new Date(at('2026-10-29')));
    expect(o.counts).toEqual({ word: 1, kanji: 0, grammar: 0 });
    expect(o.logs.get('2026-10-28')?.items['kanji:犬']).toMatchObject({ seen: 1, missed: 1 });
    expect(o.weak.map((w) => w.label)).toEqual(['犬']); // missed on two different days
  });

  it('merges several sessions in the same day', async () => {
    await recordSession(db, session('2026-10-29'));
    await recordSession(db, session('2026-10-29'));
    const o = await loadOverview(db, new Date(at('2026-10-29')));
    expect(o.logs.get('2026-10-29')).toMatchObject({ seconds: 1200, cards: 4, sessions: 2 });
  });

  it('reports the daily goal in the chosen unit', async () => {
    await saveSettings(db, { goal: { unit: 'cards', target: 3 }, freezesPerMonth: 2 });
    const s = await recordSession(db, session('2026-10-29'));
    expect(s.goal).toEqual({ unit: 'cards', target: 3, done: 2, met: false });
    const s2 = await recordSession(db, session('2026-10-29'));
    expect(s2.goal.met).toBe(true);
  });

  it('never touches content records, so a pack install and progress stay independent', async () => {
    await installPack(db, {
      manifest: { format: 1, id: 'p', kind: 'deck', title: 'P', version: 1, license: { name: 'x', url: 'https://x.org' } },
      upserts: { words: [{ id: 'a', text: 'a' }] }
    });
    await recordSession(db, session('2026-10-29'));
    expect(await listCollection(db, 'words')).toHaveLength(1);
    const keys = (await db.getAllKeys('userdata')).map(String);
    expect(keys.every((k) => k.startsWith('progress.'))).toBe(true);
  });
});

describe('settings', () => {
  it('has defaults and clamps the goal to at least 1', async () => {
    expect(await loadSettings(db)).toMatchObject({ goal: { unit: 'minutes', target: 15 }, freezesPerMonth: 1 });
    await saveSettings(db, { goal: { unit: 'minutes', target: 0 }, freezesPerMonth: 2 });
    expect((await loadSettings(db)).goal.target).toBe(1);
  });
});

describe('summary export', () => {
  it('renders text and Markdown', async () => {
    const s = await recordSession(db, session('2026-10-29'));
    expect(summaryToText(s)).toContain('đúng 50% (1/2)');
    const md = summaryToMarkdown(s);
    expect(md).toContain('# Buổi học 2026-10-29 · SRS');
    expect(md).toContain('- 犬 — sai 1 lần');
    expect(md).toContain('1 từ vựng mới');
  });
});
