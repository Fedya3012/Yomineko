// Pure helpers: date windows, scoring and ranking. No database, no network, easy to test.
import type { Challenge, ChallengeKind, Metric, Person } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Parse `YYYY-MM-DD` at local noon, so daylight-saving changes can't shift the day. */
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };

export const isDateKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fmt(parse(s)) === s;

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return fmt(d);
}

/** Monday to Sunday of the week containing `date`. */
export function weekRange(date: string): { start: string; end: string } {
  const offset = (parse(date).getDay() + 6) % 7; // Monday = 0
  const start = addDays(date, -offset);
  return { start, end: addDays(start, 6) };
}

export function monthRange(date: string): { start: string; end: string } {
  const d = parse(date);
  return { start: fmt(new Date(d.getFullYear(), d.getMonth(), 1, 12)), end: fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)) };
}

export function rangeFor(kind: Exclude<ChallengeKind, 'custom'>, today: string) {
  return kind === 'weekly' ? weekRange(today) : monthRange(today);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

export interface Window { start: string; end: string }

/**
 * A person's score for a metric inside a window, or `null` when they did not share that number.
 * "days" counts days with any minutes or cards, so it works even if only one of them is shared.
 */
export function scoreFor(p: Person, metric: Metric, w: Window): number | null {
  const visible = metric === 'days' ? p.shared.minutes || p.shared.cards : p.shared[metric];
  if (!visible) return null;
  let total = 0;
  for (const [date, d] of Object.entries(p.days)) {
    if (date < w.start || date > w.end) continue;
    if (metric === 'minutes') total += d.m ?? 0;
    else if (metric === 'cards') total += d.c ?? 0;
    else if (metric === 'words') total += d.w ?? 0;
    else if ((p.shared.minutes && (d.m ?? 0) > 0) || (p.shared.cards && (d.c ?? 0) > 0)) total++;
  }
  return total;
}

export interface Row { person: Person; score: number | null; rank: number | null }

/** Highest score first. Equal scores share a rank (1, 2, 2, 4). People who hide the number go last, unranked. */
export function leaderboard(people: Person[], metric: Metric, w: Window): Row[] {
  const rows = people.map((person) => ({ person, score: scoreFor(person, metric, w), rank: null as number | null }));
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.person.name.localeCompare(b.person.name, 'vi'));
  let prev: number | null = null;
  let rank = 0;
  rows.forEach((r, i) => {
    if (r.score === null) return;
    if (r.score !== prev) { rank = i + 1; prev = r.score; }
    r.rank = rank;
  });
  return rows;
}

export type ChallengeStatus = 'upcoming' | 'active' | 'ended';

export function challengeStatus(c: Pick<Challenge, 'start' | 'end'>, today: string): { status: ChallengeStatus; daysLeft: number } {
  if (today < c.start) return { status: 'upcoming', daysLeft: daysBetween(today, c.start) };
  if (today > c.end) return { status: 'ended', daysLeft: 0 };
  return { status: 'active', daysLeft: daysBetween(today, c.end) };
}

const KIND_NAME: Record<Exclude<ChallengeKind, 'custom'>, string> = { weekly: 'Thử thách tuần', monthly: 'Thử thách tháng' };

export function newChallenge(
  groupId: string, kind: Exclude<ChallengeKind, 'custom'>, metric: Metric, today: string, id: string, now: number, title = ''
): Challenge {
  const { start, end } = rangeFor(kind, today);
  return { id, groupId, kind, metric, start, end, title: title.trim() || `${KIND_NAME[kind]} ${start.slice(5)}`, createdAt: now };
}

let counter = 0;
/** Random id that is safe to share (letters, digits, dashes). */
export function newId(prefix: string): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : (Math.random().toString(36).slice(2, 10) + (++counter).toString(36)).padEnd(10, '0');
  return `${prefix}-${rnd}`;
}
