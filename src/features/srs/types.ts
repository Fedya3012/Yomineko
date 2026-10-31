import type { FsrsCard } from './fsrs';

/** A flashcard's content. Lives in the `cards` collection (installed through content packs). */
export interface CardContent {
  id: string;
  word: string;        // e.g. 猫
  reading: string;     // e.g. ねこ (hiragana)
  meaning: string;     // Vietnamese
  /** Optional sentence for fill-in-the-blank. `blank` must appear inside `ja`. */
  example?: { ja: string; blank: string; vi?: string };
  /** Set on cards that ship inside the kana/kanji packs: the letter this card is about. Such a card is only
   *  asked once the learner has marked that letter as learned. Cards without `ref` were added on purpose. */
  ref?: { collection: 'kana' | 'kanji'; id: string };
}

/** Letters the learner has marked as learned (kana ids and kanji ids). */
export interface LearnedSet { kana: Set<string>; kanji: Set<string> }

export type QuestionType = 'meaning' | 'audio' | 'handwrite' | 'blank';
export const ALL_TYPES: QuestionType[] = ['meaning', 'audio', 'handwrite', 'blank'];

/** Learner progress for one card. Stored in userdata under `srs.state:<cardId>`. */
export interface CardState extends FsrsCard { cardId: string; buriedUntil?: number }

/** Stored in userdata under `srs.settings`. */
export interface SrsSettings {
  newPerDay: number;
  retention: number;          // 0.8 .. 0.97
  types: QuestionType[];      // question types switched on
}
export const DEFAULT_SETTINGS: SrsSettings = { newPerDay: 10, retention: 0.9, types: [...ALL_TYPES] };

/** Stored in userdata under `srs.stats:<YYYY-MM-DD>` (local day). Also useful for the Progress thread. */
export interface DayStats { reviewed: number; newCards: number; again: number; hard: number; good: number; easy: number }
export const emptyStats = (): DayStats => ({ reviewed: 0, newCards: 0, again: 0, hard: 0, good: 0, easy: 0 });
