import { describe, it, expect } from 'vitest';
import { addDays, buildHeatmap, buildSeries, computeStreak, formatDuration, goalProgress, weakPoints } from './stats';
import type { DayLog, LearnedMap } from './types';

const log = (date: string, seconds = 600, cards = 10): DayLog => ({ date, seconds, cards, sessions: 1, items: {} });
const logs = (...dates: string[]) => new Map(dates.map((d) => [d, log(d)]));

describe('computeStreak', () => {
  it('counts consecutive days and does not break on an unfinished today', () => {
    const r = computeStreak(logs('2026-10-26', '2026-10-27', '2026-10-28'), '2026-10-29', 1);
    expect(r.current).toBe(3);
    const withToday = computeStreak(logs('2026-10-27', '2026-10-28', '2026-10-29'), '2026-10-29', 1);
    expect(withToday.current).toBe(3);
  });

  it('bridges one missed day with a freeze and reports it', () => {
    const r = computeStreak(logs('2026-10-25', '2026-10-26', '2026-10-28', '2026-10-29'), '2026-10-29', 1);
    expect(r.current).toBe(4);
    expect(r.frozenDates).toEqual(['2026-10-27']);
    expect(r.freezesLeft).toBe(0);
  });

  it('resets when the monthly freezes run out', () => {
    // Two missed days in a row, only one freeze: the second miss breaks the streak.
    const r = computeStreak(logs('2026-10-20', '2026-10-21', '2026-10-24', '2026-10-25'), '2026-10-25', 1);
    expect(r.current).toBe(2);
    expect(r.longest).toBe(2);
  });

  it('allows two freezes when configured, and refills them each month', () => {
    const two = computeStreak(logs('2026-10-20', '2026-10-23'), '2026-10-23', 2);
    expect(two.current).toBe(2); // frozen days keep the streak alive but add nothing to it
    expect(two.frozenDates).toHaveLength(2);
    const crossMonth = computeStreak(logs('2026-10-30', '2026-11-02'), '2026-11-02', 1);
    // 31 Oct (Oct allowance) and 1 Nov (Nov allowance) are each bridged by their own month's freeze.
    expect(crossMonth.current).toBe(2);
    expect(crossMonth.freezesLeft).toBe(0);
  });

  it('is zero with no study, and a freeze never starts a streak', () => {
    expect(computeStreak(new Map(), '2026-10-29', 2).current).toBe(0);
    expect(computeStreak(logs('2026-10-01'), '2026-10-29', 2).current).toBe(0);
  });
});

describe('goalProgress', () => {
  it('measures minutes or cards', () => {
    const l = log('2026-10-29', 900, 12);
    expect(goalProgress(l, { unit: 'minutes', target: 20 })).toMatchObject({ done: 15, met: false, ratio: 0.75 });
    expect(goalProgress(l, { unit: 'cards', target: 10 })).toMatchObject({ done: 12, met: true, ratio: 1 });
    expect(goalProgress(undefined, { unit: 'cards', target: 10 }).done).toBe(0);
  });
});

describe('series & heatmap', () => {
  const learned: LearnedMap = { word: { a: '2026-10-01', b: '2026-10-28', c: '2026-10-29' }, kanji: {}, grammar: { g: '2026-10-29' } };

  it('builds cumulative counts including items learned before the window', () => {
    const s = buildSeries(logs('2026-10-29'), learned, '2026-10-29', 3);
    expect(s.map((p) => p.date)).toEqual(['2026-10-27', '2026-10-28', '2026-10-29']);
    expect(s.map((p) => p.word)).toEqual([1, 2, 3]);
    expect(s[2]).toMatchObject({ grammar: 1, minutes: 10 });
  });

  it('lays the heatmap out Monday-first and leaves future days empty', () => {
    // 2026-10-29 is a Thursday.
    const h = buildHeatmap(logs('2026-10-29'), '2026-10-29', 2);
    expect(h).toHaveLength(2);
    expect(h[1][0]?.date).toBe('2026-10-26');
    expect(h[1][3]).toMatchObject({ date: '2026-10-29', minutes: 10, level: 2 });
    expect(h[1][4]).toBeNull();
  });
});

describe('helpers', () => {
  it('adds days across month ends', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'));
  it('formats durations in Vietnamese', () => {
    expect(formatDuration(25 * 60)).toBe('25 phút');
    expect(formatDuration(90 * 60)).toBe('1 giờ 30 phút');
    expect(formatDuration(120 * 60)).toBe('2 giờ');
  });
  it('only reports weak points that recur on several days', () => {
    const w = weakPoints({
      'word:1': { kind: 'word', id: '1', label: '猫', misses: 2, days: ['2026-10-28'] },
      'word:2': { kind: 'word', id: '2', label: '犬', misses: 3, days: ['2026-10-27', '2026-10-28'] }
    });
    expect(w.map((x) => x.label)).toEqual(['犬']);
  });
});
