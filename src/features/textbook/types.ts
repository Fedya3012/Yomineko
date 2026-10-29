// Data shapes for the textbook feature.
//
// CONTENT (installed from packs, stored in `records`):
//   collection `textbooks` : one row per book
//   collection `tb-lessons`: one row per lesson, `textbookId` points at its book
// LEARNER DATA (`userdata` store only):
//   `textbook.progress:<lessonId>`  : which sections are done + exercise results
//   `textbook.audio:<lessonId>:<key>`: audio files the learner attached (Blob)
//   `srs.inbox:<lessonId>`          : cards handed to the SRS thread (see srs.ts)
//
// No copyrighted book text is shipped: books are "shells" (title + lesson numbers) and the
// learner fills them with their own pack file. Audio is never shipped either.

export interface Textbook {
  id: string;
  title: string;
  titleJa?: string;
  level?: string;          // e.g. "N5"
  description?: string;
  /** Lesson ids in teaching order. */
  lessonIds: string[];
}

export interface VocabItem {
  id: string;
  word: string;
  reading?: string;
  meaning: string;
  /** Key of an audio file the learner attached; without one the device voice (TTS) is used. */
  audio?: string;
}
export interface KanjiItem { id: string; char: string; reading?: string; meaning: string }
export interface Example { ja: string; reading?: string; vi: string }
export interface GrammarPoint { id: string; title: string; pattern: string; explanation: string; examples: Example[] }
export interface DialogueLine { speaker: string; ja: string; reading?: string; vi: string }
export interface Dialogue { id: string; title: string; lines: DialogueLine[]; audio?: string }

export type Exercise =
  | { id: string; type: 'choice'; prompt: string; choices: string[]; answer: string; explain?: string; ref?: ExerciseRef }
  | { id: string; type: 'fill'; prompt: string; answer: string | string[]; explain?: string; ref?: ExerciseRef };
/** Which vocabulary / grammar entry an exercise trains, so results feed progress tracking. */
export interface ExerciseRef { kind: 'word' | 'kanji' | 'grammar'; id: string; label: string }

export interface VideoSlot { id: string; title: string; note?: string; url?: string }

export interface Lesson {
  id: string;
  textbookId: string;
  order: number;
  title: string;
  titleJa?: string;
  /** How-to-study guidance, one tip per entry. */
  guide?: string[];
  vocab?: VocabItem[];
  kanji?: KanjiItem[];
  grammar?: GrammarPoint[];
  dialogues?: Dialogue[];
  exercises?: Exercise[];
  /** Placeholder slots for short video lessons (learner's own or an open link). */
  videos?: VideoSlot[];
}

export const SECTIONS = ['guide', 'vocab', 'grammar', 'dialogue', 'practice'] as const;
export type SectionId = (typeof SECTIONS)[number];

/** `textbook.progress:<lessonId>` */
export interface LessonProgress {
  /** Sections the learner ticked as done (practice is set automatically when all exercises are right). */
  done: Partial<Record<SectionId, boolean>>;
  /** exercise id -> last answer was right? */
  results: Record<string, boolean>;
  updatedAt: number;
}
export const emptyProgress = (): LessonProgress => ({ done: {}, results: {}, updatedAt: 0 });
