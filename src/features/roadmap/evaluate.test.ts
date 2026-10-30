import { describe, it, expect } from 'vitest';
import { currentStage, goalState, stageProgress, todayState, weekdayIndex, weekStart } from './evaluate';
import { generateRoadmap } from './generate';
import { DEFAULT_ANSWERS } from './types';
import type { DayLog } from '../progress/types';

const road = generateRoadmap({ ...DEFAULT_ANSWERS, level: 'none', targetLevel: 'N4', minutesPerDay: 30 }, { now: new Date('2026-10-28T10:00:00') });
const log = (date: string, seconds: number, cards = 0): DayLog => ({ date, seconds, cards, sessions: 1, items: {} });

describe('weeks', () => {
  it('Monday is 0 and Sunday is 6', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0);
    expect(weekdayIndex('2026-10-28')).toBe(2);
    expect(weekdayIndex('2026-11-01')).toBe(6);
    expect(weekStart('2026-10-28')).toBe('2026-10-26');
  });
});

describe('stageProgress', () => {
  it('measures only what was learned after the roadmap started', () => {
    const base = { ...road, baseline: { word: 100, kanji: 10, grammar: 5 } };
    expect(stageProgress(base, { word: 100, kanji: 10, grammar: 5 })).toEqual([0, 0]);
    const half = stageProgress(base, { word: 100 + 400, kanji: 10 + 50, grammar: 5 + 20 });
    expect(half[0]).toBeCloseTo(0.5, 5);
    expect(half[1]).toBe(0);
  });
  it('spills into the next stage once the first is full, and caps at 1', () => {
    const p = stageProgress(road, { word: 5000, kanji: 5000, grammar: 5000 });
    expect(p).toEqual([1, 1]);
    expect(currentStage(p)).toBe(1);
    const mid = stageProgress(road, { word: 800 + 350, kanji: 100 + 100, grammar: 40 + 25 });
    expect(mid[0]).toBe(1);
    expect(mid[1]).toBeCloseTo(0.5, 5);
    expect(currentStage(mid)).toBe(1);
  });
  it('picks the first unfinished stage', () => {
    expect(currentStage([1, 0.2, 0])).toBe(1);
    expect(currentStage([0, 0])).toBe(0);
  });
});

describe('goalState', () => {
  const logs = new Map([['2026-10-26', log('2026-10-26', 1800)], ['2026-10-27', log('2026-10-27', 0, 5)], ['2026-10-20', log('2026-10-20', 3600)]]);
  const ctx = { logs, today: '2026-10-28', learned: { word: 30, kanji: 4, grammar: 2 }, ratios: [0.4, 0], road };
  const goal = (id: string) => road.goals.find((g) => g.id === id)!;
  it('counts only this week (Monday to today)', () => {
    expect(goalState(goal('days-week'), ctx).done).toBe(2);
    expect(goalState(goal('minutes-week'), ctx).done).toBe(30);
  });
  it('counts new words since the baseline and reports met', () => {
    const s = goalState(goal('month-word'), ctx);
    expect(s.done).toBe(30);
    expect(goalState(goal('month-word'), { ...ctx, learned: { word: 9999, kanji: 0, grammar: 0 } })).toMatchObject({ met: true, ratio: 1 });
  });
  it('stage goals follow the stage ratio', () => {
    expect(goalState(goal('stage-N5'), ctx).ratio).toBe(0.4);
  });
});

describe('todayState', () => {
  // 2026-10-28 is a Wednesday = index 2, a study day for the default 6-day plan
  const today = '2026-10-28';
  it('SRS ticks itself after a review; others need a manual tick', () => {
    const t = todayState(road, today, undefined, new Set(), 12);
    expect(t.tasks[0]).toMatchObject({ done: true });
    expect(t.tasks.slice(1).every((x) => !x.done)).toBe(true);
    expect(t.complete).toBe(false);
  });
  it('is complete when all tasks are ticked, or the planned minutes were studied', () => {
    const ids = new Set(road.week[2].tasks.map((x) => x.id));
    expect(todayState(road, today, undefined, ids, 0).complete).toBe(true);
    expect(todayState(road, today, log(today, 31 * 60), new Set(), 0).complete).toBe(true);
    expect(todayState(road, today, log(today, 10 * 60), new Set(), 0).complete).toBe(false);
  });
  it('a rest day is never "complete" and has no tasks', () => {
    const rest = { ...road, week: road.week.map((d) => (d.index === 2 ? { ...d, rest: true, tasks: [] } : d)) };
    const t = todayState(rest, today, undefined, new Set(), 0);
    expect(t).toMatchObject({ complete: false, plannedMinutes: 0 });
  });
});
