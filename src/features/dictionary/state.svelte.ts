// Shared dictionary state: the search index (built from installed packs) and the word popup.
import { getRecord, getUserData, listCollection, setUserData, type DB } from '../../lib/db';
import { DictionaryIndex } from './index';
import { JITENDEX_PACK_ID, SOURCE_KEY, parseSource, type MeaningSource } from './jitendex';
import type { Example, JitendexEntry, KanjiEntry, Word } from './types';

export const dict = $state({
  index: undefined as DictionaryIndex | undefined,
  count: 0,
  popup: [] as string[], // stack of word ids; last = shown; lets "back" work after following a related word
  /** Where the shown word was met (manga text, subtitle line); lets "add to SRS" make a sentence card. */
  context: undefined as WordContext | undefined,
  /** The optional Jitendex pack is installed. */
  hasJitendex: false,
  /** Which meanings the popup shows; kept in userdata `dict.source`. */
  source: 'both' as MeaningSource
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
  dict.hasJitendex = !!(await db.get('packs', JITENDEX_PACK_ID));
  dict.source = parseSource(await getUserData(db, SOURCE_KEY));
}

export async function setMeaningSource(source: MeaningSource): Promise<void> {
  dict.source = source;
  if (current) await setUserData(current, SOURCE_KEY, source);
}

/** Jitendex's entry for a JMdict word id, or undefined (pack not installed, or Jitendex lacks the word). */
export async function loadJitendex(id: string): Promise<JitendexEntry | undefined> {
  if (!current || !dict.hasJitendex) return undefined;
  return (await getRecord(current, 'jitendex', id)) as unknown as JitendexEntry | undefined;
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
