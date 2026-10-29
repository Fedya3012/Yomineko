// Manga and anime look words up in a flat shape ({ kanji, reading, meaning }). The dictionary packs store
// JMdict-shaped `Word` records, and the tiny demo pack stores the flat shape. This turns either into the
// flat one so tap-to-look-up works with whichever pack is installed. Ids are kept, so a flat entry's id can
// be passed to `openWord` to show the full dictionary popup.
import { listCollection, type DB } from '../../lib/db';
import type { Word } from './types';

export interface FlatEntry { id: string; kanji?: string; reading: string; meaning: string }

export function toFlatEntry(rec: unknown): FlatEntry | undefined {
  const r = rec as Partial<Word> & { kanji?: unknown; reading?: string; meaning?: string };
  if (!r || typeof r.id !== 'string') return undefined;
  if (Array.isArray(r.kana)) {
    const w = r as Word;
    const reading = w.kana[0]?.text;
    if (!reading) return undefined;
    return { id: w.id, kanji: w.kanji?.[0]?.text, reading, meaning: w.senses?.flatMap((s) => s.gloss).slice(0, 3).join('; ') ?? '' };
  }
  if (typeof r.reading === 'string' && typeof r.meaning === 'string')
    return { id: r.id, kanji: typeof r.kanji === 'string' ? r.kanji : undefined, reading: r.reading, meaning: r.meaning };
  return undefined;
}

export async function loadFlatEntries(db: DB): Promise<FlatEntry[]> {
  const rows = await listCollection(db, 'words');
  return rows.map(toFlatEntry).filter((e): e is FlatEntry => !!e);
}
