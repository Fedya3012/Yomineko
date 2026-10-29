// Shared dictionary state: the search index (built from installed packs) and the word popup.
import { getRecord, listCollection, type DB } from '../../lib/db';
import { DictionaryIndex } from './index';
import type { Example, KanjiEntry, Word } from './types';

export const dict = $state({
  index: undefined as DictionaryIndex | undefined,
  count: 0,
  popup: [] as string[], // stack of word ids; last = shown; lets "back" work after following a related word
  /** Where the shown word was met (manga text, subtitle line); lets "add to SRS" make a sentence card. */
  context: undefined as WordContext | undefined
});

export interface WordContext { sentence: string; kind: 'manga' | 'anime'; origin?: string; surface?: string }

let current: DB | undefined;

/** (Re)build the index from whatever dictionary packs are installed. Call again after installing/removing a pack. */
export async function loadDictionary(db: DB): Promise<void> {
  current = db;
  // Other packs (e.g. the tiny `demo-words` sample) also write to `words` in a simpler shape; skip anything that isn't a JMdict-style entry.
  const words = ((await listCollection(db, 'words')) as unknown as Word[]).filter((w) => Array.isArray(w.kanji) && Array.isArray(w.kana) && Array.isArray(w.senses));
  dict.index = words.length ? new DictionaryIndex(words) : undefined;
  dict.count = words.length;
}

/** Opens the popup. Pass `context` when the word comes from running text; following a related word drops it. */
export const openWord = (id: string, context?: WordContext) => { dict.context = context; dict.popup = [...dict.popup, id]; };
export const popupBack = () => { dict.popup = dict.popup.slice(0, -1); dict.context = undefined; };
export const closePopup = () => { dict.popup = []; dict.context = undefined; };
export const currentDb = () => current;

export async function loadExamples(ids: string[]): Promise<Example[]> {
  if (!current) return [];
  const rows = await Promise.all(ids.map((id) => getRecord(current!, 'examples', id)));
  return rows.filter(Boolean) as unknown as Example[];
}
export async function loadKanji(chars: string[]): Promise<KanjiEntry[]> {
  if (!current) return [];
  const rows = await Promise.all([...new Set(chars)].map((c) => getRecord(current!, 'kanji', c)));
  return rows.filter(Boolean) as unknown as KanjiEntry[];
}
