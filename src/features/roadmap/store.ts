// Reads and writes the roadmap. Learner data goes only to `userdata` (keys `roadmap.*`).
// It reads SRS / progress / lessons but only *writes* their settings when the learner presses "apply".
import { getUserData, listCollection, setUserData, type DB } from '../../lib/db';
import { loadAssistant } from '../assistant/store';
import { loadLearned, loadLogs, loadSettings as loadProgressSettings, loadWeak, saveSettings as saveProgressSettings } from '../progress/store';
import { addDays, dateKey, totalCounts, weakPoints } from '../progress/stats';
import { dayKey, loadSettings as loadSrsSettings, loadStats, saveSettings as saveSrsSettings } from '../srs/store';
import { refineWithAi, type AiDeps } from './ai';
import { generateRoadmap, normalizeAnswers } from './generate';
import type { Answers, LessonRef, Roadmap, Signals } from './types';

export const KEYS = {
  answers: 'roadmap.answers',
  plan: 'roadmap.plan',
  skipped: 'roadmap.skipped',
  ticks: (date: string) => `roadmap.ticks:${date}`
} as const;

export const loadAnswers = (db: DB) => getUserData<Answers>(db, KEYS.answers);
export const loadRoadmap = (db: DB) => getUserData<Roadmap>(db, KEYS.plan);
export const saveRoadmap = (db: DB, r: Roadmap) => setUserData(db, KEYS.plan, r);
export const isSkipped = async (db: DB) => (await getUserData<boolean>(db, KEYS.skipped)) === true;
export const setSkipped = (db: DB, v: boolean) => setUserData(db, KEYS.skipped, v);

export async function loadTicks(db: DB, date: string): Promise<Set<string>> {
  return new Set((await getUserData<string[]>(db, KEYS.ticks(date))) ?? []);
}
export async function setTick(db: DB, date: string, taskId: string, on: boolean): Promise<Set<string>> {
  const ticks = await loadTicks(db, date);
  if (on) ticks.add(taskId); else ticks.delete(taskId);
  await setUserData(db, KEYS.ticks(date), [...ticks]);
  return ticks;
}

/** Lessons already installed by content packs (the textbook thread owns them). Empty when none. */
export async function loadLessons(db: DB): Promise<LessonRef[]> {
  const rows = (await listCollection(db, 'lessons')) as unknown as Record<string, unknown>[];
  return rows.filter((r) => typeof r.id === 'string').map((r) => ({
    id: r.id as string,
    title: typeof r.title === 'string' ? r.title : undefined,
    level: typeof r.level === 'string' ? r.level : undefined,
    order: typeof r.order === 'number' ? r.order : undefined,
    book: typeof r.book === 'string' ? r.book : undefined
  }));
}

/** What the app already knows about the learner: used to make regeneration smarter. */
export async function loadSignals(db: DB, now = new Date()): Promise<Signals> {
  const [logs, learned, weak] = await Promise.all([loadLogs(db), loadLearned(db), loadWeak(db)]);
  const today = dateKey(now);
  let seconds = 0, studiedDays = 0;
  for (let i = 0; i < 14; i++) {
    const s = logs.get(addDays(today, -i))?.seconds ?? 0;
    seconds += s;
    if (s > 0) studiedDays++;
  }
  return {
    // With no history at all there is nothing to compare, so leave it undefined.
    avgMinutes14: studiedDays ? seconds / 60 / 14 : undefined,
    weakKinds: [...new Set(weakPoints(weak).map((w) => w.kind))],
    learned: totalCounts(learned)
  };
}

export interface CreateOptions { now?: Date; ai?: AiDeps; useAi?: boolean }

/**
 * Builds a new roadmap from answers, saves both, and returns it.
 * Always works offline: the AI step is optional and any failure keeps the rule-based result.
 */
export async function createRoadmap(db: DB, raw: Partial<Answers>, opts: CreateOptions = {}): Promise<Roadmap> {
  const now = opts.now ?? new Date();
  const answers = normalizeAnswers(raw);
  const [signals, lessons, prev] = await Promise.all([loadSignals(db, now), loadLessons(db), loadRoadmap(db)]);
  // Keep the old starting point when the start level is unchanged, so regenerating doesn't reset progress bars.
  const sameStart = prev && prev.startLevel === generateRoadmap(answers, { now }).startLevel;
  let road = generateRoadmap(answers, { now, lessons, signals, baseline: sameStart ? prev.baseline : signals.learned });
  if (opts.useAi !== false) {
    const { settings, apiKey } = await loadAssistant(db);
    road = await refineWithAi(road, settings, apiKey, opts.ai);
  }
  await setUserData(db, KEYS.answers, answers);
  await saveRoadmap(db, road);
  await setSkipped(db, false);
  return road;
}

/** Copies the suggested daily goal and new-cards-per-day into the progress and SRS settings. */
export async function applySuggestions(db: DB, road: Roadmap): Promise<void> {
  const [srs, progress] = await Promise.all([loadSrsSettings(db), loadProgressSettings(db)]);
  await saveSrsSettings(db, { ...srs, newPerDay: road.suggest.srsNewPerDay });
  await saveProgressSettings(db, { ...progress, goal: { unit: 'minutes', target: road.suggest.goalMinutes } });
}

/** Everything the roadmap screens need about today, in one read. */
export async function loadLive(db: DB, now = new Date()) {
  const today = dateKey(now);
  const [logs, learned, ticks, srsStats] = await Promise.all([loadLogs(db), loadLearned(db), loadTicks(db, today), loadStats(db, dayKey(now.getTime()))]);
  return { today, logs, learned: totalCounts(learned), ticks, srsReviewed: srsStats.reviewed };
}
