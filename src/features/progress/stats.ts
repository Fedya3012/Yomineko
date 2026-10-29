// Pure functions: no database, no clock. Feed them data, get numbers back. Easy to test.
import type { DayLog, GoalUnit, ItemKind, LearnedMap, ProgressSettings, WeakMap } from './types';

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Date maths goes through UTC so daylight-saving changes can never skip or repeat a day.
const toUtc = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (key: string, n: number) => fromUtc(toUtc(key) + n * 86_400_000);
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
const monthOf = (key: string) => key.slice(0, 7);

const studied = (l?: DayLog) => !!l && (l.seconds > 0 || l.cards > 0);

export interface StreakResult {
  current: number;
  longest: number;
  /** Days that were bridged by a freeze. */
  frozenDates: string[];
  /** Freezes still available this month. */
  freezesLeft: number;
}

/**
 * Walks forward from the first study day. A missed day is covered by a freeze while the month's
 * allowance lasts; otherwise the streak resets. Today never counts as missed (the day isn't over).
 * Computed from the logs each time, so there is no extra state to get out of sync.
 */
export function computeStreak(logs: Map<string, DayLog>, today: string, freezesPerMonth: number): StreakResult {
  const dates = [...logs.keys()].filter((k) => studied(logs.get(k))).sort();
  const frozenDates: string[] = [];
  const usedByMonth = new Map<string, number>();
  let current = 0, longest = 0;
  if (dates.length) {
    for (let day = dates[0]; day <= today; day = addDays(day, 1)) {
      if (studied(logs.get(day))) current++;
      else if (day !== today) {
        const used = usedByMonth.get(monthOf(day)) ?? 0;
        if (current > 0 && used < freezesPerMonth) { usedByMonth.set(monthOf(day), used + 1); frozenDates.push(day); }
        else current = 0;
      }
      longest = Math.max(longest, current);
    }
  }
  const usedNow = usedByMonth.get(monthOf(today)) ?? 0;
  return { current, longest, frozenDates, freezesLeft: Math.max(0, freezesPerMonth - usedNow) };
}

export interface GoalProgress { unit: GoalUnit; target: number; done: number; met: boolean; ratio: number }

export function goalProgress(log: DayLog | undefined, goal: ProgressSettings['goal']): GoalProgress {
  const done = goal.unit === 'minutes' ? Math.floor((log?.seconds ?? 0) / 60) : (log?.cards ?? 0);
  return { unit: goal.unit, target: goal.target, done, met: done >= goal.target, ratio: Math.min(1, done / goal.target) };
}

export function totalCounts(learned: LearnedMap): Record<ItemKind, number> {
  return { word: Object.keys(learned.word).length, kanji: Object.keys(learned.kanji).length, grammar: Object.keys(learned.grammar).length };
}

export const totalSeconds = (logs: Iterable<DayLog>) => { let s = 0; for (const l of logs) s += l.seconds; return s; };

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} giờ ${r} phút` : `${h} giờ`;
}

export interface SeriesPoint { date: string; word: number; kanji: number; grammar: number; minutes: number }

/** One point per day over the last `days` days: cumulative learned counts + that day's minutes. */
export function buildSeries(logs: Map<string, DayLog>, learned: LearnedMap, today: string, days: number): SeriesPoint[] {
  const start = addDays(today, -(days - 1));
  const before = (kind: ItemKind) => Object.values(learned[kind]).filter((d) => d < start).length;
  const base = { word: before('word'), kanji: before('kanji'), grammar: before('grammar') };
  const out: SeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    for (const k of ['word', 'kanji', 'grammar'] as const) base[k] += Object.values(learned[k]).filter((d) => d === date).length;
    out.push({ date, ...base, minutes: Math.round((logs.get(date)?.seconds ?? 0) / 60) });
  }
  return out;
}

export interface HeatCell { date: string; minutes: number; level: 0 | 1 | 2 | 3 | 4 }

/** Weeks (columns) × 7 days, Monday first, ending with the week containing `today`. Future cells are omitted. */
export function buildHeatmap(logs: Map<string, DayLog>, today: string, weeks: number): (HeatCell | null)[][] {
  const dow = (new Date(toUtc(today)).getUTCDay() + 6) % 7; // Monday = 0
  const firstMonday = addDays(today, -dow - (weeks - 1) * 7);
  const level = (min: number): HeatCell['level'] => (min <= 0 ? 0 : min < 5 ? 1 : min < 15 ? 2 : min < 30 ? 3 : 4);
  const cols: (HeatCell | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: (HeatCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(firstMonday, w * 7 + d);
      if (date > today) { col.push(null); continue; }
      const minutes = Math.round((logs.get(date)?.seconds ?? 0) / 60);
      const cardsOnly = minutes === 0 && (logs.get(date)?.cards ?? 0) > 0;
      col.push({ date, minutes, level: cardsOnly ? 1 : level(minutes) });
    }
    cols.push(col);
  }
  return cols;
}

/** Items that were missed on at least `minDays` different days, worst first. */
export function weakPoints(weak: WeakMap, minDays = 2, limit = 10) {
  return Object.values(weak)
    .filter((w) => w.days.length >= minDays)
    .sort((a, b) => b.days.length - a.days.length || b.misses - a.misses)
    .slice(0, limit);
}
