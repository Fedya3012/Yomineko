import { describe, it, expect } from 'vitest';
import { editWeek, generateRoadmap, normalizeAnswers, pickLessons, suggestedNewPerDay, weekMinutes } from './generate';
import { DEFAULT_ANSWERS, type Answers } from './types';

const now = new Date('2026-10-28T10:00:00'); // a Wednesday
const make = (over: Partial<Answers> = {}, opts = {}) => generateRoadmap({ ...DEFAULT_ANSWERS, ...over }, { now, ...opts });

describe('normalizeAnswers', () => {
  it('clamps minutes and days, and never lets the target sit below the starting level', () => {
    const a = normalizeAnswers({ minutesPerDay: 17, daysPerWeek: 99, level: 'N3', targetLevel: 'N5' });
    expect(a).toMatchObject({ minutesPerDay: 15, daysPerWeek: 7, targetLevel: 'N2' });
    expect(normalizeAnswers({ minutesPerDay: 0 }).minutesPerDay).toBe(15);
    expect(normalizeAnswers({ minutesPerDay: 9999 }).minutesPerDay).toBe(180);
  });
  it('removes duplicate weak points', () => {
    expect(normalizeAnswers({ weak: ['kanji', 'kanji'] }).weak).toEqual(['kanji']);
  });
});

describe('stages', () => {
  it('runs from the next level up to the target, back to back, with cumulative targets', () => {
    const r = make({ level: 'N5', targetLevel: 'N3' });
    expect(r.startLevel).toBe('N4');
    expect(r.stages.map((s) => s.level)).toEqual(['N4', 'N3']);
    expect(r.stages[0].startDate).toBe('2026-10-28');
    expect(r.stages[1].startDate).toBe(new Date(Date.UTC(2026, 9, 28 + r.stages[0].weeks * 7)).toISOString().slice(0, 10));
    expect(r.stages[1].upTo.word).toBe(r.stages[0].add.word + r.stages[1].add.word);
  });
  it('takes longer when the learner studies less', () => {
    const slow = make({ minutesPerDay: 10, daysPerWeek: 3 });
    const fast = make({ minutesPerDay: 60, daysPerWeek: 7 });
    expect(slow.stages[0].weeks).toBeGreaterThan(fast.stages[0].weeks);
  });
  it('full N5-to-N1 path has five stages', () => {
    expect(make({ targetLevel: 'N1' }).stages.map((s) => s.level)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1']);
  });
});

describe('weekly schedule', () => {
  it('uses the chosen number of study days and spreads the rest days', () => {
    const r = make({ daysPerWeek: 3 });
    expect(r.week.filter((d) => !d.rest).map((d) => d.index)).toEqual([0, 2, 4]);
    expect(r.week).toHaveLength(7);
  });
  it('every study day adds up exactly to the daily minutes, with an SRS task each day', () => {
    for (const minutes of [5, 10, 15, 25, 30, 45, 60, 90]) {
      const r = make({ minutesPerDay: minutes });
      for (const d of r.week.filter((x) => !x.rest)) {
        expect(d.tasks.reduce((s, t) => s + t.minutes, 0)).toBe(minutes);
        expect(d.tasks[0].kind).toBe('srs');
        expect(new Set(d.tasks.map((t) => t.kind)).size).toBe(d.tasks.length);
        expect(d.tasks.every((t) => t.minutes >= 5)).toBe(true);
      }
    }
  });
  it('weekMinutes matches days x minutes', () => {
    expect(weekMinutes(make({ minutesPerDay: 20, daysPerWeek: 5 }).week)).toBe(100);
  });
  it('task ids are unique inside the plan', () => {
    const ids = make({ minutesPerDay: 60 }).week.flatMap((d) => d.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('personalisation', () => {
  const count = (r: ReturnType<typeof make>, kind: string) => r.week.flatMap((d) => d.tasks).filter((t) => t.kind === kind).length;
  it('an anime goal with immersion style has more anime than a textbook JLPT learner', () => {
    const anime = make({ goal: 'anime', style: 'immersion', level: 'N4', minutesPerDay: 45 });
    const book = make({ goal: 'jlpt', style: 'textbook', level: 'N4', minutesPerDay: 45 });
    expect(count(anime, 'anime')).toBeGreaterThan(count(book, 'anime'));
    expect(count(book, 'lesson')).toBeGreaterThan(count(anime, 'lesson'));
  });
  it('a weak point gets more time', () => {
    const base = make({ minutesPerDay: 45, level: 'N4' });
    const weak = make({ minutesPerDay: 45, level: 'N4', weak: ['speaking'] });
    expect(count(weak, 'speaking')).toBeGreaterThanOrEqual(count(base, 'speaking'));
  });
  it('beginners do not get immersion-heavy weeks', () => {
    const r = make({ level: 'none', minutesPerDay: 30, style: 'immersion' });
    const manga = count(r, 'manga') + count(r, 'anime');
    const adv = count(make({ level: 'N3', minutesPerDay: 30, style: 'immersion' }), 'manga') + count(make({ level: 'N3', minutesPerDay: 30, style: 'immersion' }), 'anime');
    expect(manga).toBeLessThanOrEqual(adv);
  });
  it('rotates the two series when the learner likes both', () => {
    const r = make({ content: 'both', style: 'immersion', minutesPerDay: 45, level: 'N4' });
    const titles = r.week.flatMap((d) => d.tasks).filter((t) => t.kind === 'manga' || t.kind === 'anime').map((t) => t.title).join(' ');
    expect(titles).toContain('One Piece');
    expect(titles).toContain('D.Gray-man');
  });
  it('shows chapter ranges for the current stage, never bundled content', () => {
    const t = make({ content: 'onepiece', style: 'immersion', minutesPerDay: 45, level: 'none' }).week.flatMap((d) => d.tasks).find((x) => x.kind === 'manga');
    expect(t?.detail).toContain('chương 1–3');
  });
  it('suggests a lighter plan when the learner has been missing sessions', () => {
    const r = make({ minutesPerDay: 30 }, { signals: { avgMinutes14: 6 } });
    expect(r.tips.join(' ')).toContain('giảm xuống');
  });
  it('no suggestion to reduce when history is missing or on track', () => {
    expect(make({ minutesPerDay: 30 }).tips.join(' ')).not.toContain('giảm xuống');
    expect(make({ minutesPerDay: 30 }, { signals: { avgMinutes14: 28 } }).tips.join(' ')).not.toContain('giảm xuống');
  });
});

describe('lessons', () => {
  const lessons = [
    { id: 'm2', title: 'Bài 2', level: 'N5', order: 2, book: 'minna' }, { id: 'm1', title: 'Bài 1', level: 'N5', order: 1, book: 'minna' },
    { id: 'g1', title: 'Genki 1', level: 'N5', order: 1, book: 'genki' }, { id: 'n4', title: 'Bài 26', level: 'N4', order: 26, book: 'minna' }
  ];
  it('pickLessons filters by level and book and sorts by order', () => {
    expect(pickLessons(lessons, 'N5', 'minna').map((l) => l.id)).toEqual(['m1', 'm2']);
    expect(pickLessons(lessons, 'N5', 'any').map((l) => l.id)).toContain('g1');
    expect(pickLessons(lessons, 'N3', 'minna').map((l) => l.id)).toEqual(['m1', 'm2', 'n4']); // fallback: whole book
  });
  it('lesson tasks link to real lessons in order', () => {
    const r = make({ style: 'textbook', book: 'minna', minutesPerDay: 45 }, { lessons });
    const tasks = r.week.flatMap((d) => d.tasks).filter((t) => t.kind === 'lesson');
    expect(tasks[0].lessonId).toBe('m1');
    expect(tasks[1].lessonId).toBe('m2');
  });
  it('without lessons installed a non-textbook plan has no lesson tasks, a textbook plan has a generic one', () => {
    expect(make({ style: 'balanced', minutesPerDay: 60 }).week.flatMap((d) => d.tasks).some((t) => t.kind === 'lesson')).toBe(false);
    const t = make({ style: 'textbook', minutesPerDay: 45 }).week.flatMap((d) => d.tasks).find((x) => x.kind === 'lesson');
    expect(t && !t.lessonId).toBe(true);
  });
});

describe('goals and suggestions', () => {
  it('has short and long term goals, one stage goal per stage', () => {
    const r = make({ targetLevel: 'N3', level: 'N5' });
    expect(r.goals.filter((g) => g.term === 'long').map((g) => g.stage)).toEqual([0, 1]);
    expect(r.goals.some((g) => g.term === 'short' && g.metric === 'days-week')).toBe(true);
    expect(r.goals.every((g) => g.target > 0)).toBe(true);
  });
  it('suggests SRS and daily-goal settings that match the plan', () => {
    const r = make({ minutesPerDay: 30 });
    expect(r.suggest).toEqual({ srsNewPerDay: suggestedNewPerDay(30), goalMinutes: 30 });
    expect(suggestedNewPerDay(5)).toBe(5);
    expect(suggestedNewPerDay(180)).toBe(25);
  });
  it('is deterministic for the same input', () => {
    expect(make()).toEqual(make());
  });
});

describe('editWeek', () => {
  it('turns a day into a rest day, and back using another day as the model', () => {
    const r = make({ daysPerWeek: 5, minutesPerDay: 30 });
    const off = editWeek(r, { type: 'rest', index: 1 });
    expect(off.week[1]).toMatchObject({ rest: true, tasks: [] });
    const on = editWeek(off, { type: 'study', index: 5 });
    expect(on.week[5].rest).toBe(false);
    expect(on.week[5].tasks[0].id.startsWith('5:')).toBe(true);
  });
  it('changes minutes within limits and removes a task, without touching the original', () => {
    const r = make({ minutesPerDay: 30 });
    const id = r.week[0].tasks[1].id;
    const before = r.week[0].tasks[1].minutes;
    expect(editWeek(r, { type: 'minutes', taskId: id, delta: 5 }).week[0].tasks[1].minutes).toBe(before + 5);
    expect(editWeek(r, { type: 'minutes', taskId: id, delta: -999 }).week[0].tasks[1].minutes).toBe(5);
    expect(editWeek(r, { type: 'remove', taskId: id }).week[0].tasks.some((t) => t.id === id)).toBe(false);
    expect(r.week[0].tasks[1].minutes).toBe(before);
  });
});
