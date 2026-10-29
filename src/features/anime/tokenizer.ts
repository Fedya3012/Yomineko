// Splits a subtitle line into clickable words.
// Strategy: greedy longest match against the dictionary (with de-inflection), falling back to the
// browser's built-in Japanese word segmenter (Intl.Segmenter) for words the dictionary doesn't know.
import { deinflect } from './deinflect';

export interface DictEntry { id: string; kanji?: string; reading: string; meaning: string }

export interface Token {
  surface: string;
  /** dictionary entry if found (the word in dictionary form). */
  entry?: DictEntry;
  /** stable key used for "known words": entry id, or the surface for unknown words. */
  key: string;
  /** false for punctuation, digits, Latin text and one-letter grammar bits: not counted for comprehension. */
  countable: boolean;
}

export type DictIndex = Map<string, DictEntry>;
const MAX_WORD = 10;

export function buildIndex(entries: DictEntry[]): DictIndex {
  const index: DictIndex = new Map();
  for (const e of entries) {
    if (e.kanji && !index.has(e.kanji)) index.set(e.kanji, e);
    if (!index.has(e.reading)) index.set(e.reading, e);
  }
  return index;
}

const JP = /[ぁ-ゖァ-ヺー一-鿿㐀-䶿々]/;
const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/;

function lookup(index: DictIndex, surface: string): DictEntry | undefined {
  for (const cand of deinflect(surface)) {
    const hit = index.get(cand);
    if (hit) return hit;
  }
  return undefined;
}

function isCountable(surface: string, entry?: DictEntry): boolean {
  if (!JP.test(surface)) return false;
  // A lone hiragana letter is almost always a particle (は, が, を, に…) and not worth tracking.
  if (!entry && HIRAGANA_ONLY.test(surface) && surface.length <= 1) return false;
  return true;
}

let segmenter: Intl.Segmenter | undefined;
function fallbackBounds(text: string): Map<number, string> {
  segmenter ??= new Intl.Segmenter('ja', { granularity: 'word' });
  const m = new Map<number, string>();
  for (const s of segmenter.segment(text)) m.set(s.index, s.segment);
  return m;
}

export function tokenize(text: string, index: DictIndex): Token[] {
  const tokens: Token[] = [];
  const fallback = fallbackBounds(text);
  let i = 0;
  while (i < text.length) {
    let found: { len: number; entry: DictEntry } | undefined;
    for (let len = Math.min(MAX_WORD, text.length - i); len >= 1 && !found; len--) {
      const piece = text.slice(i, i + len);
      if (!JP.test(piece[0])) break;
      const entry = lookup(index, piece);
      // Single hiragana letters match too much ("は", "を"), so only accept them as part of longer words.
      if (entry && !(len === 1 && HIRAGANA_ONLY.test(piece))) found = { len, entry };
    }
    if (found) {
      const surface = text.slice(i, i + found.len);
      tokens.push({ surface, entry: found.entry, key: found.entry.id, countable: isCountable(surface, found.entry) });
      i += found.len;
      continue;
    }
    let surface = fallback.get(i);
    if (!surface) {
      // `i` fell inside a segment already consumed by a dictionary match: take one character.
      surface = text[i];
    }
    tokens.push({ surface, key: surface, countable: isCountable(surface) });
    i += surface.length;
  }
  return tokens;
}
