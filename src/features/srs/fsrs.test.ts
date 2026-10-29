import { describe, it, expect } from 'vitest';
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS, formatInterval, newCard, nextInterval, previewIntervals, retrievability, review } from './fsrs';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);

describe('FSRS maths', () => {
  it('retrievability is 90% when elapsed days equal stability', () => {
    expect(retrievability(5, 5)).toBeCloseTo(0.9, 5);
    expect(retrievability(0, 5)).toBe(1);
  });
  it('interval for 90% retention equals the stability', () => {
    expect(nextInterval(10, DEFAULT_PARAMS)).toBe(10);
    expect(nextInterval(10, { ...DEFAULT_PARAMS, retention: 0.8 })).toBeGreaterThan(10);
    expect(nextInterval(1e6, DEFAULT_PARAMS)).toBe(DEFAULT_PARAMS.maxIntervalDays);
  });
  it('first answer uses the published starting stability', () => {
    const good = review(newCard(T0), 3, T0);
    expect(good.stability).toBeCloseTo(DEFAULT_WEIGHTS[2], 5);
    expect(good.phase).toBe('review');
    expect(good.due).toBe(T0 + 3 * DAY);
  });
});

describe('scheduling behaviour', () => {
  it('a failed new card comes back in minutes, not days', () => {
    const c = review(newCard(T0), 1, T0);
    expect(c.phase).toBe('learning');
    expect(c.due - T0).toBe(10 * 60_000);
  });
  it('Again < Hard < Good < Easy on a new card', () => {
    const [a, h, g, e] = previewIntervals(newCard(T0), T0);
    expect(a).toBeLessThan(h); expect(h).toBeLessThanOrEqual(g); expect(g).toBeLessThan(e);
  });
  it('well-known cards are spaced further and further apart', () => {
    let c = review(newCard(T0), 3, T0), now = c.due, last = c.due - T0;
    for (let i = 0; i < 4; i++) {
      c = review(c, 3, now); const gap = c.due - now;
      expect(gap).toBeGreaterThan(last); last = gap; now = c.due;
    }
  });
  it('forgetting a mature card shrinks its stability, counts a lapse and brings it back soon', () => {
    let c = review(newCard(T0), 4, T0);
    const now = c.due + 2 * DAY;
    const before = c.stability;
    c = review(c, 1, now);
    expect(c.stability).toBeLessThan(before);
    expect(c.lapses).toBe(1);
    expect(c.phase).toBe('relearning');
    expect(c.due - now).toBe(10 * 60_000);
  });
  it('Easy grows stability more than Good, Hard least', () => {
    const base = review(newCard(T0), 3, T0); const now = base.due;
    const s = ([2, 3, 4] as const).map((g) => review(base, g, now).stability);
    expect(s[0]).toBeLessThan(s[1]); expect(s[1]).toBeLessThan(s[2]);
  });
  it('does not mutate the input card', () => {
    const c = newCard(T0); const copy = { ...c };
    review(c, 3, T0); expect(c).toEqual(copy);
  });
  it('difficulty stays within 1..10', () => {
    let c = review(newCard(T0), 1, T0);
    for (let i = 0; i < 30; i++) c = review(c, 1, c.due + DAY);
    expect(c.difficulty).toBeLessThanOrEqual(10);
    for (let i = 0; i < 30; i++) c = review(c, 4, c.due + DAY);
    expect(c.difficulty).toBeGreaterThanOrEqual(1);
  });
});

describe('formatInterval', () => {
  it('uses Vietnamese units', () => {
    expect(formatInterval(10 * 60_000)).toBe('10 phút');
    expect(formatInterval(3 * 3_600_000)).toBe('3 giờ');
    expect(formatInterval(3 * DAY)).toBe('3 ngày');
    expect(formatInterval(90 * DAY)).toBe('3 tháng');
    expect(formatInterval(730 * DAY)).toBe('2 năm');
  });
});
