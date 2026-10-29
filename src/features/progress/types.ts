// Data shapes for the progress feature. Everything here lives in the `userdata` store only
// (keys `progress.*`); content packs are never read or written.

export type ItemKind = 'word' | 'kanji' | 'grammar';
export type GoalUnit = 'minutes' | 'cards';

/** One thing the learner was quizzed on. The SRS / reader threads report these. */
export interface StudiedItem {
  kind: ItemKind;
  id: string;
  /** Short text to show in history, e.g. "猫 (ねこ)". */
  label: string;
  correct: boolean;
  /** True when the item just became "learned" (e.g. graduated in SRS). Counted once. */
  learned?: boolean;
}

/** What a feature thread hands over when a study session ends. */
export interface SessionInput {
  /** Local time the session ended, ms since epoch. */
  endedAt: number;
  seconds: number;
  /** Where it came from, e.g. "SRS", "Kanji", "Manga". */
  source?: string;
  items: StudiedItem[];
}

/** Compact per-item stats inside one day. */
export interface DayItem { kind: ItemKind; id: string; label: string; seen: number; missed: number }

/** `progress.day:<YYYY-MM-DD>` */
export interface DayLog {
  date: string;
  seconds: number;
  cards: number;
  sessions: number;
  items: Record<string, DayItem>;
}

/** `progress.learned` : first date each item became learned. */
export type LearnedMap = Record<ItemKind, Record<string, string>>;

export interface WeakItem { kind: ItemKind; id: string; label: string; misses: number; days: string[] }
/** `progress.weak` */
export type WeakMap = Record<string, WeakItem>;

/** `progress.settings` */
export interface ProgressSettings {
  goal: { unit: GoalUnit; target: number };
  /** Streak-freeze days the learner gets each calendar month (1 or 2). */
  freezesPerMonth: 1 | 2;
}

export const DEFAULT_PROGRESS_SETTINGS: ProgressSettings = { goal: { unit: 'minutes', target: 15 }, freezesPerMonth: 1 };

export interface SessionSummary {
  date: string;
  source?: string;
  minutes: number;
  cards: number;
  correct: number;
  accuracy: number; // 0..1
  newlyLearned: Record<ItemKind, number>;
  weak: { label: string; misses: number }[];
  goal: { unit: GoalUnit; target: number; done: number; met: boolean };
  streak: number;
}
