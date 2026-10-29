import { describe, it, expect } from 'vitest';
import { sampleIndex } from './fixtures';
import { relatedWords } from './related';

const idx = sampleIndex();

describe('relatedWords', () => {
  it('lists antonyms and cross-references written in the entry', () => {
    expect(relatedWords(idx, idx.get('s-ookii')!).antonyms.map((w) => w.id)).toEqual(['s-chiisai']);
    expect(relatedWords(idx, idx.get('s-inu')!).seeAlso.map((w) => w.id)).toEqual(['s-neko']);
  });

  it('lists other words that share a kanji, without the word itself', () => {
    const ids = relatedWords(idx, idx.get('s-yomu')!).sameKanji.map((w) => w.id);
    expect(ids).toContain('s-dokusho');
    expect(ids).toContain('s-dokusha');
    expect(ids).not.toContain('s-yomu');
    expect(relatedWords(idx, idx.get('s-hon')!).sameKanji.map((w) => w.id)).toContain('s-honya');
  });

  it('never repeats a word across groups and handles kana-only words', () => {
    const r = relatedWords(idx, idx.get('s-suru')!);
    expect(r.sameKanji).toEqual([]);
    const all = [...r.seeAlso, ...r.antonyms, ...r.sameKanji].map((w) => w.id);
    expect(new Set(all).size).toBe(all.length);
  });
});
