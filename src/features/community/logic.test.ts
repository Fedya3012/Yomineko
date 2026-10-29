import { describe, it, expect } from 'vitest';
import { addDays, challengeStatus, daysBetween, isDateKey, leaderboard, monthRange, newChallenge, scoreFor, weekRange } from './logic';
import type { Person } from './types';

const ALL = { minutes: true, cards: true, words: true, streak: true };
const person = (id: string, days: Person['days'], shared = ALL): Person => ({ id, name: id, shared, days, updatedAt: 1 });

describe('date windows', () => {
  it('week runs Monday to Sunday', () => {
    expect(weekRange('2026-10-29')).toEqual({ start: '2026-10-26', end: '2026-11-01' }); // Thursday
    expect(weekRange('2026-10-26').start).toBe('2026-10-26'); // Monday
    expect(weekRange('2026-11-01').start).toBe('2026-10-26'); // Sunday belongs to the same week
  });
  it('month covers the whole calendar month, including leap February', () => {
    expect(monthRange('2026-10-29')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthRange('2028-02-10').end).toBe('2028-02-29');
  });
  it('adds and counts days across month/year/daylight-saving borders', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-03-20', '2026-04-05')).toBe(16);
  });
  it('validates date strings', () => {
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-2-3')).toBe(false);
    expect(isDateKey('2026-10-29')).toBe(true);
  });
});

describe('scoring', () => {
  const w = { start: '2026-10-26', end: '2026-11-01' };
  const p = person('a', { '2026-10-25': { m: 99, c: 99, w: 9 }, '2026-10-26': { m: 10, c: 20, w: 1 }, '2026-10-28': { m: 5, c: 0, w: 2 }, '2026-11-02': { m: 99 } });
  it('sums only days inside the window (both ends inclusive)', () => {
    expect(scoreFor(p, 'minutes', w)).toBe(15);
    expect(scoreFor(p, 'cards', w)).toBe(20);
    expect(scoreFor(p, 'words', w)).toBe(3);
    expect(scoreFor(p, 'days', w)).toBe(2);
  });
  it('returns null (hidden) for anything the person did not share', () => {
    const q = person('b', p.days, { ...ALL, minutes: false });
    expect(scoreFor(q, 'minutes', w)).toBeNull();
    expect(scoreFor(q, 'days', w)).toBe(1); // cards are still shared: only the 26th has cards
  });
});

describe('leaderboard', () => {
  const w = { start: '2026-10-26', end: '2026-11-01' };
  it('ranks high to low, ties share a rank, hidden people go last without a rank', () => {
    const rows = leaderboard([
      person('Cam', { '2026-10-27': { m: 10 } }),
      person('An', { '2026-10-27': { m: 30 } }),
      person('Binh', { '2026-10-27': { m: 30 } }),
      person('Hidden', { '2026-10-27': { m: 99 } }, { ...ALL, minutes: false })
    ], 'minutes', w);
    expect(rows.map((r) => [r.person.id, r.rank])).toEqual([['An', 1], ['Binh', 1], ['Cam', 3], ['Hidden', null]]);
  });
  it('gives someone with zero a rank, since zero was shared on purpose', () => {
    const rows = leaderboard([person('a', {})], 'minutes', w);
    expect(rows[0]).toMatchObject({ score: 0, rank: 1 });
  });
});

describe('challenges', () => {
  it('builds weekly and monthly challenges from today', () => {
    const c = newChallenge('g-1', 'weekly', 'cards', '2026-10-29', 'c-1', 5);
    expect(c).toMatchObject({ start: '2026-10-26', end: '2026-11-01', metric: 'cards', kind: 'weekly' });
    expect(c.title).toContain('tuần');
    expect(newChallenge('g-1', 'monthly', 'days', '2026-10-29', 'c-2', 5, '  Cả nhà cố lên  ').title).toBe('Cả nhà cố lên');
  });
  it('reports upcoming, active and ended with days left', () => {
    const c = { start: '2026-10-26', end: '2026-11-01' };
    expect(challengeStatus(c, '2026-10-20')).toEqual({ status: 'upcoming', daysLeft: 6 });
    expect(challengeStatus(c, '2026-10-29')).toEqual({ status: 'active', daysLeft: 3 });
    expect(challengeStatus(c, '2026-11-01')).toEqual({ status: 'active', daysLeft: 0 });
    expect(challengeStatus(c, '2026-11-02').status).toBe('ended');
  });
});
