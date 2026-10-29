import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import demoPack from '../../../packs-src/demo-words/v1.json';
import { buildWordIndex, loadWordIndex, lookupAt, type WordEntry } from './lookup';
import type { OcrBlock } from './ocr/types';

const words: WordEntry[] = [
  { id: 'neko', kanji: '猫', reading: 'ねこ', meaning: 'con mèo' },
  { id: 'yomu', kanji: '読む', reading: 'よむ', meaning: 'đọc' },
  { id: 'hon', kanji: '本', reading: 'ほん', meaning: 'sách' },
  { id: 'honto', kanji: '本当', reading: 'ほんとう', meaning: 'thật sự' },
  { id: 'wo', reading: 'を', meaning: 'trợ từ tân ngữ' }
];
const index = buildWordIndex(words);
const blockOf = (text: string): OcrBlock => ({
  id: 0, text, orientation: 'vertical', conf: 90, box: { x0: 0, y0: 0, x1: 1, y1: 1 }, chars: []
});

describe('lookupAt', () => {
  const block = blockOf('猫は本を読む');

  it('finds a single-character word', () => {
    expect(lookupAt(index, block, 0)).toMatchObject({ surface: '猫', start: 0, length: 1 });
    expect(lookupAt(index, block, 0).entries[0].meaning).toBe('con mèo');
  });

  it('tapping the second letter still returns the whole word', () => {
    const r = lookupAt(index, block, 5); // む of 読む
    expect(r).toMatchObject({ surface: '読む', start: 4, length: 2 });
  });

  it('prefers the longest word', () => {
    expect(lookupAt(index, blockOf('本当に'), 0)).toMatchObject({ surface: '本当', length: 2 });
    expect(lookupAt(index, blockOf('本当に'), 1)).toMatchObject({ surface: '本当', start: 0 });
  });

  it('matches kana-only words by reading', () => {
    expect(lookupAt(index, block, 3).entries[0].id).toBe('wo');
    expect(lookupAt(buildWordIndex(words), blockOf('ねこ'), 0).entries[0].id).toBe('neko');
  });

  it('returns just the character when nothing matches', () => {
    expect(lookupAt(index, block, 1)).toMatchObject({ surface: 'は', length: 1, entries: [] });
  });
});

describe('word index from the offline database', () => {
  it('reads the words installed by a content pack', async () => {
    const db = await openDatabase('test-lookup');
    await installPack(db, demoPack);
    const idx = await loadWordIndex(db);
    expect(lookupAt(idx, blockOf('猫が読む'), 0).entries[0].reading).toBe('ねこ');
  });
});
