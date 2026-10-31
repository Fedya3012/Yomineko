import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, setUserData, type DB } from '../../lib/db';
import { ReviewSession, UNDO_WINDOW_MS, QUICK_SESSION_MS, buildQueue, countQueue, type Persist } from './session';
import { dayKey, deleteState, loadSettings, loadStates, loadStats, saveSettings, saveState, saveStats, stateKey } from './store';
import { DEFAULT_SETTINGS, emptyStats, type CardContent } from './types';
import { installPack } from '../../lib/packs/install';

const T0 = new Date(2026, 5, 1, 9, 0, 0).getTime();
const DAY = 86_400_000;
const cards: CardContent[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, word: id, reading: id, meaning: id }));

let db: DB; let n = 0;
const persistTo = (d: DB): Persist => ({
  saveState: async (s) => { await saveState(d, s); },
  deleteState: (id) => deleteState(d, id),
  saveStats: async (day, s) => { await saveStats(d, day, s); }
});
beforeEach(async () => { db = await openDatabase(`srs-${n++}`); });

const start = async (opts: { now?: number; quick?: boolean; settings?: Partial<typeof DEFAULT_SETTINGS> } = {}) => {
  const now = opts.now ?? T0;
  return new ReviewSession(cards, await loadStates(db), { ...DEFAULT_SETTINGS, ...opts.settings },
    await loadStats(db, dayKey(now)), persistTo(db), { now, quick: opts.quick });
};

describe('only learned content', () => {
  const kana: CardContent[] = [
    { id: 'k1', word: 'あ', reading: 'あ', meaning: 'a', ref: { collection: 'kana', id: 'hira:あ' } },
    { id: 'k2', word: 'い', reading: 'い', meaning: 'i', ref: { collection: 'kana', id: 'hira:い' } },
    { id: 'j1', word: '一', reading: 'いち', meaning: 'một', ref: { collection: 'kanji', id: '一' } },
    { id: 'own', word: '猫', reading: 'ねこ', meaning: 'mèo' }
  ];
  const run = (learned: { kana: string[]; kanji: string[] }, states = new Map()) =>
    buildQueue({ cards: kana, states, settings: DEFAULT_SETTINGS, stats: emptyStats(), now: T0, learned: { kana: new Set(learned.kana), kanji: new Set(learned.kanji) } });

  it('a brand-new learner gets no kana or kanji cards, only cards they added themselves', () => {
    expect(run({ kana: [], kanji: [] })).toEqual(['own']);
  });
  it('a partly-learned learner gets only the letters they marked', () => {
    expect(run({ kana: ['hira:あ'], kanji: [] })).toEqual(['k1', 'own']);
    expect(run({ kana: ['hira:あ'], kanji: ['一'] })).toEqual(['k1', 'j1', 'own']);
  });
  it('a card already reviewed stays in the schedule', () => {
    const st = new Map([['k2', { cardId: 'k2', due: T0 - 1 } as never]]);
    expect(run({ kana: [], kanji: [] }, st)).toEqual(['k2', 'own']);
  });
  it('counts follow the same rule', () => {
    const c = countQueue({ cards: kana, states: new Map(), settings: DEFAULT_SETTINGS, stats: emptyStats(), now: T0, learned: { kana: new Set(), kanji: new Set() } });
    expect(c).toEqual({ due: 0, fresh: 1 });
  });
});

describe('queue', () => {
  it('limits new cards per day', () => {
    const q = buildQueue({ cards, states: new Map(), settings: { ...DEFAULT_SETTINGS, newPerDay: 2 }, stats: emptyStats(), now: T0 });
    expect(q).toEqual(['a', 'b']);
    expect(buildQueue({ cards, states: new Map(), settings: { ...DEFAULT_SETTINGS, newPerDay: 2 }, stats: { ...emptyStats(), newCards: 2 }, now: T0 })).toEqual([]);
  });
  it('puts due cards before new ones and skips cards not yet due', async () => {
    const s = await start({ settings: { newPerDay: 1 } });
    await s.answer(3, T0); // a -> due in 3 days
    const later = await start({ now: T0 + 4 * DAY, settings: { newPerDay: 1 } });
    expect(later.currentCard?.id).toBe('a');
    expect(later.remaining).toBe(2);
    const same = await start({ settings: { newPerDay: 0 } });
    expect(same.remaining).toBe(0);
  });
  it('countQueue splits due and new', async () => {
    const s = await start({ settings: { newPerDay: 3 } });
    await s.answer(4, T0);
    const states = await loadStates(db);
    expect(countQueue({ cards, states, settings: DEFAULT_SETTINGS, stats: await loadStats(db, dayKey(T0)), now: T0 + 40 * DAY }))
      .toEqual({ due: 1, fresh: 4 });
  });
});

describe('answering', () => {
  it('saves progress in userdata and survives a restart', async () => {
    const s = await start();
    await s.answer(3, T0);
    expect(await db.get('userdata', stateKey('a'))).toBeTruthy();
    expect((await loadStates(db)).get('a')?.reps).toBe(1);
    expect((await loadStats(db, dayKey(T0))).newCards).toBe(1);
  });
  it('a failed card returns after 3 other cards, a known card does not return', async () => {
    const s = await start();
    await s.answer(1, T0);               // a fails
    expect(s.remaining).toBe(5);
    await s.answer(3, T0); await s.answer(3, T0); await s.answer(3, T0);
    expect(s.currentCard?.id).toBe('a');
    await s.answer(3, T0);
    expect(s.remaining).toBe(1);
  });
  it('failed cards are due sooner than easy ones', async () => {
    const s = await start();
    await s.answer(1, T0); await s.answer(4, T0);
    const st = await loadStates(db);
    expect(st.get('a')!.due).toBeLessThan(st.get('b')!.due);
  });
  it('bury hides a card until tomorrow', async () => {
    const s = await start({ settings: { newPerDay: 1 } });
    await s.answer(3, T0);
    const t = T0 + 4 * DAY;
    const s2 = await start({ now: t, settings: { newPerDay: 0 } });
    await s2.bury(t);
    expect((await start({ now: t + 1000, settings: { newPerDay: 0 } })).remaining).toBe(0);
    expect((await start({ now: t + DAY + 1000, settings: { newPerDay: 0 } })).remaining).toBe(1);
  });
});

describe('undo', () => {
  it('restores a brand-new card, the queue and the daily counters', async () => {
    const s = await start();
    await s.answer(3, T0);
    expect(await s.undo(T0 + 2000)).toBe(true);
    expect(s.currentCard?.id).toBe('a');
    expect(s.remaining).toBe(5);
    expect(await db.get('userdata', stateKey('a'))).toBeUndefined();
    expect((await loadStats(db, dayKey(T0))).reviewed).toBe(0);
  });
  it('restores the previous state of a card that was already learned', async () => {
    const s = await start({ settings: { newPerDay: 1 } });
    await s.answer(3, T0);
    const before = (await loadStates(db)).get('a')!;
    const t = T0 + 4 * DAY;
    const s2 = await start({ now: t, settings: { newPerDay: 0 } });
    await s2.answer(1, t);
    await s2.undo(t + 1000);
    expect((await loadStates(db)).get('a')).toEqual(before);
  });
  it('also undoes a bury', async () => {
    const s = await start();
    await s.bury(T0);
    expect(s.currentCard?.id).toBe('b');
    await s.undo(T0 + 1000);
    expect(s.currentCard?.id).toBe('a');
  });
  it('is refused after the time window and counts down', async () => {
    const s = await start();
    await s.answer(3, T0);
    expect(s.undoMsLeft(T0 + 1000)).toBe(UNDO_WINDOW_MS - 1000);
    expect(await s.undo(T0 + UNDO_WINDOW_MS + 1)).toBe(false);
    expect(s.undoMsLeft(T0 + UNDO_WINDOW_MS + 1)).toBe(0);
    expect(await db.get('userdata', stateKey('a'))).toBeTruthy();
  });
  it('only reverses the most recent action', async () => {
    const s = await start();
    await s.answer(3, T0); await s.answer(3, T0 + 1000);
    await s.undo(T0 + 2000);
    expect(s.currentCard?.id).toBe('b');
    expect(await s.undo(T0 + 2100)).toBe(false);
  });
});

describe('answer log for Progress', () => {
  it('records correctness and drops the entry on undo', async () => {
    const s = await start();
    await s.answer(1, T0); await s.answer(4, T0 + 1000);
    expect(s.answerLog.map((a) => [a.cardId, a.correct, a.learned])).toEqual([['a', false, false], ['b', true, false]]);
    await s.undo(T0 + 1500);
    expect(s.answerLog).toHaveLength(1);
  });
  it('marks a card learned once its memory should last 3+ weeks', async () => {
    const s = await start({ settings: { newPerDay: 1 } });
    await s.answer(4, T0); // Easy on a new card: ~15 days
    expect(s.answerLog[0].learned).toBe(false);
    const t = T0 + 20 * DAY;
    const s2 = await start({ now: t, settings: { newPerDay: 0 } });
    await s2.answer(4, t);
    expect(s2.answerLog[0].learned).toBe(true);
  });
});

describe('quick 5-minute review', () => {
  it('ends when five minutes are over, even with cards left', async () => {
    const s = await start({ quick: true });
    expect(s.finished(T0 + QUICK_SESSION_MS - 1)).toBe(false);
    expect(s.finished(T0 + QUICK_SESSION_MS)).toBe(true);
    expect((await start()).finished(T0 + QUICK_SESSION_MS)).toBe(false);
  });
});

describe('settings and packs', () => {
  it('settings round-trip with defaults filled in', async () => {
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(db, { ...DEFAULT_SETTINGS, newPerDay: 3 });
    expect((await loadSettings(db)).newPerDay).toBe(3);
  });
  it('progress survives uninstalling/reinstalling the card pack', async () => {
    const license = { name: 'CC0', url: 'https://example.org' };
    const pack = { manifest: { format: 1 as const, id: 'p', kind: 'deck' as const, title: 'p', version: 1, license }, upserts: { cards } };
    await installPack(db, pack);
    await setUserData(db, stateKey('a'), { cardId: 'a' });
    await installPack(db, { ...pack, manifest: { ...pack.manifest, version: 2 } });
    expect(await db.get('userdata', stateKey('a'))).toEqual({ cardId: 'a' });
  });
});
