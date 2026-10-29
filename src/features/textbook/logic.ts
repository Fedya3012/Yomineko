// Pure helpers (no database, no screen) so they are easy to test.
import { SECTIONS, type Exercise, type Lesson, type LessonProgress, type SectionId, type Source, type SourceType } from './types';

/** Sections that actually have content in this lesson. The progress bar only counts those. */
export function availableSections(l: Lesson): SectionId[] {
  const has: Record<SectionId, boolean> = {
    guide: !!l.guide?.length,
    vocab: !!(l.vocab?.length || l.kanji?.length),
    grammar: !!l.grammar?.length,
    dialogue: !!l.dialogues?.length,
    practice: !!l.exercises?.length
  };
  return SECTIONS.filter((s) => has[s]);
}

/** 0..1. A lesson with no content yet is 0, never "complete". */
export function lessonRatio(l: Lesson, p: LessonProgress): number {
  const sections = availableSections(l);
  if (!sections.length) return 0;
  return sections.filter((s) => p.done[s]).length / sections.length;
}

export const isEmptyLesson = (l: Lesson) => availableSections(l).length === 0;

const norm = (s: string) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();

export function checkAnswer(e: Exercise, given: string): boolean {
  const accepted = Array.isArray(e.answer) ? e.answer : [e.answer];
  return given.trim() !== '' && accepted.some((a) => norm(a) === norm(given));
}

/** True when every exercise of the lesson has been answered correctly at least once. */
export function practiceComplete(l: Lesson, results: Record<string, boolean>): boolean {
  const ex = l.exercises ?? [];
  return ex.length > 0 && ex.every((e) => results[e.id]);
}

/** Overall ratio for a book: average over its lessons that have content. */
export function bookRatio(lessons: Lesson[], progress: Map<string, LessonProgress>): number {
  if (!lessons.length) return 0;
  const sum = lessons.reduce((a, l) => a + lessonRatio(l, progress.get(l.id) ?? { done: {}, results: {}, updatedAt: 0 }), 0);
  return sum / lessons.length;
}

/** First lesson of the book that is not finished yet (where "Tiếp tục" should go). */
export function nextLesson(lessons: Lesson[], progress: Map<string, LessonProgress>): Lesson | undefined {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  return sorted.find((l) => !isEmptyLesson(l) && lessonRatio(l, progress.get(l.id) ?? { done: {}, results: {}, updatedAt: 0 }) < 1);
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  textbook: 'Giáo trình', anime: 'Anime', music: 'Nhạc', manga: 'Manga', dictionary: 'Từ điển', user: 'Bạn thêm'
};

/** The item's own source, else the lesson's, else a plain "textbook". */
export const effectiveSource = (item: { source?: Source } | undefined, lesson: Lesson): Source =>
  item?.source ?? lesson.source ?? { type: 'textbook' };

/** One-line description: "Anime · One Piece · 12:31 — ghi chú". */
export function describeSource(s: Source): string {
  const head = [SOURCE_LABELS[s.type], s.title, s.location].filter(Boolean).join(' · ');
  return s.note ? `${head} — ${s.note}` : head;
}
