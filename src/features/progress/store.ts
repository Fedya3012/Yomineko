// Reads and writes the progress data. Only the `userdata` store is touched, never `records`.
import type { DB } from '../../lib/db';
import { computeStreak, dateKey, goalProgress, totalCounts, weakPoints } from './stats';
import {
  DEFAULT_PROGRESS_SETTINGS, type DayLog, type ItemKind, type LearnedMap, type ProgressSettings,
  type SessionInput, type SessionSummary, type WeakMap
} from './types';

const DAY_PREFIX = 'progress.day:';
export const KEYS = {
  day: (date: string) => `${DAY_PREFIX}${date}`,
  learned: 'progress.learned',
  weak: 'progress.weak',
  settings: 'progress.settings'
} as const;

const emptyLearned = (): LearnedMap => ({ word: {}, kanji: {}, grammar: {} });
const WEAK_DAYS_KEPT = 30;

export async function loadSettings(db: DB): Promise<ProgressSettings> {
  const s = (await db.get('userdata', KEYS.settings)) as Partial<ProgressSettings> | undefined;
  return { ...DEFAULT_PROGRESS_SETTINGS, ...s, goal: { ...DEFAULT_PROGRESS_SETTINGS.goal, ...s?.goal } };
}

export async function saveSettings(db: DB, s: ProgressSettings): Promise<void> {
  const target = Math.max(1, Math.round(s.goal.target));
  await db.put('userdata', { ...s, goal: { ...s.goal, target } }, KEYS.settings);
}

export async function loadLogs(db: DB): Promise<Map<string, DayLog>> {
  const range = IDBKeyRange.bound(DAY_PREFIX, DAY_PREFIX + '￿');
  const [keys, values] = await Promise.all([db.getAllKeys('userdata', range), db.getAll('userdata', range)]);
  return new Map(keys.map((k, i) => [String(k).slice(DAY_PREFIX.length), values[i] as DayLog]));
}

export async function loadLearned(db: DB): Promise<LearnedMap> {
  return { ...emptyLearned(), ...(((await db.get('userdata', KEYS.learned)) as LearnedMap | undefined) ?? {}) };
}

export async function loadWeak(db: DB): Promise<WeakMap> {
  return ((await db.get('userdata', KEYS.weak)) as WeakMap | undefined) ?? {};
}

/**
 * Called by SRS / kanji / reader threads when a study session ends.
 * Everything is written in one transaction so a crash can't leave half a session behind.
 */
export async function recordSession(db: DB, input: SessionInput, now = new Date(input.endedAt)): Promise<SessionSummary> {
  const date = dateKey(now);
  const tx = db.transaction('userdata', 'readwrite');
  const store = tx.store;
  const [oldLog, oldLearned, oldWeak] = await Promise.all([
    store.get(KEYS.day(date)) as Promise<DayLog | undefined>,
    store.get(KEYS.learned) as Promise<LearnedMap | undefined>,
    store.get(KEYS.weak) as Promise<WeakMap | undefined>
  ]);
  const log: DayLog = oldLog ?? { date, seconds: 0, cards: 0, sessions: 0, items: {} };
  const learned: LearnedMap = { ...emptyLearned(), ...oldLearned };
  const weak: WeakMap = { ...oldWeak };
  const newly: Record<ItemKind, number> = { word: 0, kanji: 0, grammar: 0 };
  const missedNow = new Map<string, number>();
  let correct = 0;

  for (const it of input.items) {
    const key = `${it.kind}:${it.id}`;
    const d = (log.items[key] ??= { kind: it.kind, id: it.id, label: it.label, seen: 0, missed: 0 });
    d.label = it.label;
    if (it.tag) d.tag = it.tag;
    d.seen++;
    if (it.correct) correct++;
    else {
      d.missed++;
      missedNow.set(key, (missedNow.get(key) ?? 0) + 1);
      const w = (weak[key] = weak[key] ? { ...weak[key] } : { kind: it.kind, id: it.id, label: it.label, misses: 0, days: [] });
      w.label = it.label;
      w.misses++;
      if (!w.days.includes(date)) w.days = [...w.days, date].slice(-WEAK_DAYS_KEPT);
    }
    if (it.learned && !learned[it.kind][it.id]) { learned[it.kind] = { ...learned[it.kind], [it.id]: date }; newly[it.kind]++; }
  }
  log.seconds += Math.max(0, Math.round(input.seconds));
  log.cards += input.items.length;
  log.sessions++;

  store.put(log, KEYS.day(date));
  store.put(learned, KEYS.learned);
  store.put(weak, KEYS.weak);
  await tx.done;

  const [settings, logs] = [await loadSettings(db), await loadLogs(db)];
  const goal = goalProgress(log, settings.goal);
  return {
    date,
    source: input.source,
    minutes: Math.round(input.seconds / 60),
    cards: input.items.length,
    correct,
    accuracy: input.items.length ? correct / input.items.length : 0,
    newlyLearned: newly,
    weak: [...missedNow.entries()].map(([key, n]) => ({ label: weak[key].label, misses: n })).sort((a, b) => b.misses - a.misses).slice(0, 5),
    goal: { unit: goal.unit, target: goal.target, done: goal.done, met: goal.met },
    streak: computeStreak(logs, date, settings.freezesPerMonth).current
  };
}

/** Everything the screen needs, read in one go. */
export async function loadOverview(db: DB, now = new Date()) {
  const today = dateKey(now);
  const [settings, logs, learned, weak] = await Promise.all([loadSettings(db), loadLogs(db), loadLearned(db), loadWeak(db)]);
  return {
    today, settings, logs, learned,
    streak: computeStreak(logs, today, settings.freezesPerMonth),
    goal: goalProgress(logs.get(today), settings.goal),
    counts: totalCounts(learned),
    weak: weakPoints(weak)
  };
}
