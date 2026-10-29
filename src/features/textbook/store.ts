// Reads and writes the textbook learner data. Only the `userdata` store is written.
import type { DB } from '../../lib/db';
import { listCollection } from '../../lib/db';
import { recordSession } from '../progress/store';
import type { SessionSummary, StudiedItem } from '../progress/types';
import { practiceComplete } from './logic';
import { emptyProgress, type Lesson, type LessonProgress, type SectionId, type Textbook } from './types';

export const KEYS = {
  progress: (lessonId: string) => `textbook.progress:${lessonId}`,
  audio: (lessonId: string, key: string) => `textbook.audio:${lessonId}:${key}`
} as const;

export const loadTextbooks = async (db: DB) => (await listCollection(db, 'textbooks')) as unknown as Textbook[];

export async function loadLessons(db: DB, textbookId?: string): Promise<Lesson[]> {
  const all = (await listCollection(db, 'tb-lessons')) as unknown as Lesson[];
  return all.filter((l) => !textbookId || l.textbookId === textbookId).sort((a, b) => a.order - b.order);
}

export async function loadProgress(db: DB, lessonId: string): Promise<LessonProgress> {
  const p = (await db.get('userdata', KEYS.progress(lessonId))) as LessonProgress | undefined;
  return { ...emptyProgress(), ...p };
}

export async function loadAllProgress(db: DB, lessons: Lesson[]): Promise<Map<string, LessonProgress>> {
  return new Map(await Promise.all(lessons.map(async (l) => [l.id, await loadProgress(db, l.id)] as const)));
}

export async function setSectionDone(db: DB, lessonId: string, section: SectionId, done: boolean, now = Date.now()) {
  const p = await loadProgress(db, lessonId);
  const next = { ...p, done: { ...p.done, [section]: done }, updatedAt: now };
  await db.put('userdata', next, KEYS.progress(lessonId));
  return next;
}

/**
 * Stores one exercise answer. When it is the first correct answer, the item is reported to the
 * progress feature (streak, "learned" counters, weak points) as a tiny session.
 * Finishing every exercise ticks the "practice" section automatically.
 */
export async function answerExercise(
  db: DB, lesson: Lesson, exerciseId: string, correct: boolean, now = Date.now()
): Promise<{ progress: LessonProgress; summary?: SessionSummary }> {
  const ex = lesson.exercises?.find((e) => e.id === exerciseId);
  const p = await loadProgress(db, lesson.id);
  const firstTimeRight = correct && !p.results[exerciseId];
  const results = { ...p.results, [exerciseId]: correct || (p.results[exerciseId] ?? false) };
  const done = { ...p.done };
  if (practiceComplete(lesson, results)) done.practice = true;
  const progress: LessonProgress = { done, results, updatedAt: now };
  await db.put('userdata', progress, KEYS.progress(lesson.id));

  let summary: SessionSummary | undefined;
  if (ex?.ref) {
    const item: StudiedItem = { ...ex.ref, correct, learned: firstTimeRight };
    summary = await recordSession(db, { endedAt: now, seconds: 30, source: `Giáo trình · ${lesson.title}`, items: [item] });
  }
  return { progress, summary };
}

export async function resetLesson(db: DB, lessonId: string) {
  await db.delete('userdata', KEYS.progress(lessonId));
}

// ---- audio the learner attached (their own files; never shipped with the app) ----

export const saveAudio = (db: DB, lessonId: string, key: string, file: Blob) =>
  db.put('userdata', file, KEYS.audio(lessonId, key));
export const loadAudio = (db: DB, lessonId: string, key: string) =>
  db.get('userdata', KEYS.audio(lessonId, key)) as Promise<Blob | undefined>;
export const removeAudio = (db: DB, lessonId: string, key: string) => db.delete('userdata', KEYS.audio(lessonId, key));

// ---- the learner's own notes for a lesson ----
const notesKey = (lessonId: string) => `textbook.notes:${lessonId}`;
export const loadNotes = async (db: DB, lessonId: string) => ((await db.get('userdata', notesKey(lessonId))) as string | undefined) ?? '';
export const saveNotes = (db: DB, lessonId: string, text: string) => db.put('userdata', text, notesKey(lessonId));
