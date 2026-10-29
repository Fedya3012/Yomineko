// Tap-to-translate: from a tapped character, find the word that starts there and its meaning.
// Words come from the `words` collection of the offline database (filled by the dictionary pack).
import type { DB } from '../../lib/db';
import { loadFlatEntries } from '../dictionary/flat';
import type { OcrBlock } from './ocr/types';

export interface WordEntry {
  id: string;
  /** Written form with kanji, if any ("猫"). */
  kanji?: string;
  reading: string;
  meaning: string;
}

/** surface form (kanji or kana spelling) -> entries */
export type WordIndex = Map<string, WordEntry[]>;

const MAX_WORD_LENGTH = 12;

export function buildWordIndex(records: WordEntry[]): WordIndex {
  const index: WordIndex = new Map();
  const add = (key: string | undefined, entry: WordEntry) => {
    if (!key) return;
    const list = index.get(key);
    if (list) list.push(entry); else index.set(key, [entry]);
  };
  for (const r of records) {
    add(r.kanji, r);
    if (r.reading !== r.kanji) add(r.reading, r);
  }
  return index;
}

export async function loadWordIndex(db: DB): Promise<WordIndex> {
  return buildWordIndex(await loadFlatEntries(db));
}

export interface LookupResult {
  /** Tapped character index inside block.text. */
  index: number;
  /** Longest dictionary word starting at the tapped character (or just the character if none). */
  surface: string;
  /** Characters covered, so the UI can highlight them. */
  start: number;
  length: number;
  entries: WordEntry[];
}

/**
 * Greedy longest match. A tap in the middle of a word (e.g. on 静 of 静かに) also considers words that
 * START EARLIER and still cover the tap, so tapping any letter of "読む" shows 読む, not just 読.
 */
export function lookupAt(index: WordIndex, block: OcrBlock, tapped: number): LookupResult {
  const text = block.text;
  let best: { start: number; length: number } | undefined;
  for (let start = Math.max(0, tapped - (MAX_WORD_LENGTH - 1)); start <= tapped; start++) {
    for (let len = Math.min(MAX_WORD_LENGTH, text.length - start); len >= 1 && start + len > tapped; len--) {
      if (!index.has(text.slice(start, start + len))) continue;
      // prefer the longer word; on a tie, the one starting at the tap
      if (!best || len > best.length || (len === best.length && start > best.start)) best = { start, length: len };
      break;
    }
  }
  if (!best) return { index: tapped, surface: text[tapped] ?? '', start: tapped, length: 1, entries: [] };
  const surface = text.slice(best.start, best.start + best.length);
  return { index: tapped, surface, start: best.start, length: best.length, entries: index.get(surface) ?? [] };
}
