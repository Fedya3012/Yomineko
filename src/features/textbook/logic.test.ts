import { describe, it, expect } from 'vitest';
import { availableSections, bookRatio, checkAnswer, isEmptyLesson, lessonRatio, nextLesson, practiceComplete } from './logic';
import type { Lesson } from './types';

const base: Lesson = { id: 'b-l01', textbookId: 'b', order: 1, title: 'Bài 1' };
const full: Lesson = {
  ...base, guide: ['x'], vocab: [{ id: 'a', word: 'あ', meaning: 'a' }],
  exercises: [{ id: 'e1', type: 'choice', prompt: '?', choices: ['a', 'b'], answer: 'a' }, { id: 'e2', type: 'fill', prompt: '?', answer: ['学生', 'がくせい'] }]
};

describe('progress ratio', () => {
  it('counts only sections that have content, and an empty lesson is never complete', () => {
    expect(isEmptyLesson(base)).toBe(true);
    expect(lessonRatio(base, { done: { guide: true }, results: {}, updatedAt: 0 })).toBe(0);
    expect(availableSections(full)).toEqual(['guide', 'vocab', 'practice']);
    expect(lessonRatio(full, { done: { guide: true }, results: {}, updatedAt: 0 })).toBeCloseTo(1 / 3);
    expect(lessonRatio(full, { done: { guide: true, vocab: true, practice: true }, results: {}, updatedAt: 0 })).toBe(1);
  });
  it('averages a book and finds the next unfinished lesson, skipping empty frames', () => {
    const l2 = { ...full, id: 'b-l02', order: 2 };
    const done = new Map([[l2.id, { done: { guide: true, vocab: true, practice: true }, results: {}, updatedAt: 0 }]]);
    expect(bookRatio([base, full, l2], done)).toBeCloseTo(1 / 3);
    expect(nextLesson([base, l2, full], done)?.id).toBe('b-l01'); // `full` has order 1 and is unfinished
    expect(nextLesson([base], new Map())).toBeUndefined();
  });
});

describe('answers', () => {
  it('accepts any listed answer, ignores spaces and full-width forms, rejects blanks', () => {
    const [choice, fill] = full.exercises!;
    expect(checkAnswer(choice, 'a')).toBe(true);
    expect(checkAnswer(choice, 'b')).toBe(false);
    expect(checkAnswer(fill, ' がくせい ')).toBe(true);
    expect(checkAnswer(fill, '学生')).toBe(true);
    expect(checkAnswer(fill, '')).toBe(false);
    expect(checkAnswer({ id: 'x', type: 'fill', prompt: '', answer: 'ABC' }, 'ａｂｃ')).toBe(true);
  });
  it('practice is complete only when every exercise was answered right', () => {
    expect(practiceComplete(full, { e1: true })).toBe(false);
    expect(practiceComplete(full, { e1: true, e2: true })).toBe(true);
    expect(practiceComplete(base, {})).toBe(false);
  });
});
