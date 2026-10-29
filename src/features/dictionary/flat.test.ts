import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import samplePack from '../../../packs-src/dict-sample/v1.json';
import { loadFlatEntries, toFlatEntry } from './flat';
import { buildWordIndex, lookupAt } from '../manga/lookup';
import { buildIndex, tokenize } from '../anime/tokenizer';

describe('flat dictionary entries', () => {
  it('flattens JMdict-shaped words and keeps the id', () => {
    expect(toFlatEntry({ id: 'x', kanji: [{ text: '猫' }], kana: [{ text: 'ねこ' }], senses: [{ pos: ['n'], gloss: ['cat', 'feline'] }], common: true }))
      .toEqual({ id: 'x', kanji: '猫', reading: 'ねこ', meaning: 'cat; feline' });
    expect(toFlatEntry({ id: 'y', kanji: [], kana: [{ text: 'です' }], senses: [{ pos: [], gloss: ['is'] }], common: true })).toMatchObject({ kanji: undefined, reading: 'です' });
  });
  it('passes the flat demo shape through and drops junk', () => {
    expect(toFlatEntry({ id: 'neko', kanji: '猫', reading: 'ねこ', meaning: 'con mèo' })).toEqual({ id: 'neko', kanji: '猫', reading: 'ねこ', meaning: 'con mèo' });
    expect(toFlatEntry({ id: 'bad' })).toBeUndefined();
    expect(toFlatEntry(null)).toBeUndefined();
  });
  it('lets manga and anime look words up in a real dictionary pack', async () => {
    const db = await openDatabase('flat-1');
    await installPack(db, samplePack);
    const entries = await loadFlatEntries(db);
    expect(entries.length).toBeGreaterThan(10);
    const manga = lookupAt(buildWordIndex(entries), { text: '猫は走る' } as never, 0);
    expect(manga.entries[0]).toMatchObject({ kanji: '猫', reading: 'ねこ' });
    const tokens = tokenize('猫は', buildIndex(entries));
    expect(tokens[0].entry?.id).toBe(manga.entries[0].id);
  });
});
