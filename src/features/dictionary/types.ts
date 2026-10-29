// Record shapes of the dictionary collections. Packs are produced by scripts/dict-convert.mjs
// (real data) or written by hand (packs-src/dict-sample/v1.json); both use these shapes.

export interface KanjiForm { text: string; common?: boolean }
export interface KanaForm {
  text: string;
  common?: boolean;
  /** Only valid for these kanji spellings; empty/absent = valid for all. */
  kanji?: string[];
}
export interface Sense {
  /** JMdict part-of-speech codes, e.g. "n", "v1", "v5k", "adj-i", "vs-i". */
  pos: string[];
  gloss: string[];
  /** Cross-references and antonyms, written as the spelling of the other word (e.g. "犬"). */
  related?: string[];
  antonym?: string[];
}

/** Collection `words` (JMdict). */
export interface Word {
  id: string;
  kanji: KanjiForm[];
  kana: KanaForm[];
  senses: Sense[];
  common: boolean;
  /** JLPT level 5 (N5, easiest) .. 1 (N1). Unofficial lists, may be absent. */
  jlpt?: number;
  /** Position in a frequency list (1 = most frequent). Only present when the pack was built with one. */
  rank?: number;
  /** Ids in the `examples` collection. */
  ex?: string[];
}

/** Collection `examples` (Tatoeba sentences linked from JMdict). */
export interface Example { id: string; ja: string; en: string; words?: string[] }

/** Collection `kanji` (KANJIDIC2). */
export interface KanjiEntry {
  id: string;            // the character itself
  on: string[];          // katakana readings
  kun: string[];         // hiragana readings, "." separates okurigana
  meanings: string[];
  strokes?: number;
  grade?: number;        // Japanese school grade; 8 = other jōyō, 9-10 = jinmeiyō
  freq?: number;         // 1..2500
  jlptOld?: number;      // old 4-level JLPT scale (4 = easiest)
}

/** One meaning in a Jitendex entry. Jitendex numbers its senses and groups them by part of speech itself. */
export interface JitendexSense {
  pos: string[];
  gloss: string[];
  /** Usage tags: misc ("uk", "abbr"), field ("food") and dialect codes. */
  tags?: string[];
  /** Usage notes, e.g. "usu. ～にかかる". */
  note?: string[];
  /** Word origin, e.g. `English: "blue day"`. */
  lang?: string;
  ex?: { ja: string; en: string };
}

/** Collection `jitendex` (Jitendex). `id` is the JMdict entry number, i.e. the id of the matching `words` record. */
export interface JitendexEntry { id: string; senses: JitendexSense[] }

export type DictRecord = Word | Example | KanjiEntry | JitendexEntry;

export interface SearchHit { word: Word; score: number; matched: 'form' | 'reading' | 'gloss' }
