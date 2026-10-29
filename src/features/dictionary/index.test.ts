import { describe, it, expect } from 'vitest';
import { sampleIndex } from './fixtures';

const idx = sampleIndex();
const ids = (q: string) => idx.search(q).map((h) => h.word.id);

describe('DictionaryIndex.search', () => {
  it('finds by kanji, hiragana, katakana and romaji', () => {
    for (const q of ['猫', 'ねこ', 'ネコ', 'neko', 'NEKO']) expect(ids(q)[0], q).toBe('s-neko');
  });

  it('finds by English meaning, exact meaning first', () => {
    expect(ids('cat')[0]).toBe('s-neko');
    expect(ids('to read')[0]).toBe('s-yomu');
    expect(ids('book')).toContain('s-hon');
    expect(ids('quiet')).toEqual(['s-shizuka']);
  });

  it('matches word starts: 読 finds 読む, 読書, 読者, exact word first', () => {
    const r = ids('読');
    expect(r.slice(0, 3).sort()).toEqual(['s-dokusha', 's-dokusho', 's-yomu']);
    expect(ids('よ')[0]).toBe('s-yomu');
    expect(ids('boo')).toContain('s-hon'); // prefix of the last English word
  });

  it('puts exact matches above prefix matches', () => {
    expect(ids('ほん')[0]).toBe('s-hon');
    expect(ids('ほん')).toContain('s-honya');
  });

  it('returns nothing for empty or unknown queries', () => {
    expect(idx.search('')).toEqual([]);
    expect(idx.search('   ')).toEqual([]);
    expect(idx.search('zzzzqq')).toEqual([]);
  });

  it('reports what matched', () => {
    expect(idx.search('猫')[0].matched).toBe('form');
    expect(idx.search('cat')[0].matched).toBe('gloss');
  });

  it('respects the limit', () => expect(idx.search('い', 2)).toHaveLength(2));

  it('looks words up by id and exact spelling', () => {
    expect(idx.get('s-inu')?.kanji[0].text).toBe('犬');
    expect(idx.findByForm('いぬ')[0].id).toBe('s-inu');
    expect(idx.get('nope')).toBeUndefined();
  });
});
