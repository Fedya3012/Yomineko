import { describe, it, expect } from 'vitest';
import { sampleIndex } from './fixtures';
import { lookupAt } from './lookup';

const idx = sampleIndex();
const first = (text: string, pos = 0) => lookupAt(idx, text, pos);

describe('lookupAt', () => {
  it('picks the longest word: 本屋 beats 本', () => {
    expect(first('本屋に行く')?.words[0].id).toBe('s-honya');
    expect(first('本屋に行く')?.length).toBe(2);
  });

  it('works from any position inside a sentence', () => {
    const s = '猫は静かに本を読む。';
    expect(first(s, 0)?.words[0].id).toBe('s-neko');
    expect(first(s, 2)?.words[0].id).toBe('s-shizuka');
    expect(first(s, 5)?.words[0].id).toBe('s-hon');
    expect(first(s, 7)?.words[0].id).toBe('s-yomu');
  });

  it.each([
    ['食べました', 's-taberu'], ['食べない', 's-taberu'], ['食べている', 's-taberu'],
    ['読みます', 's-yomu'], ['読んで', 's-yomu'], ['読んだ', 's-yomu'], ['読まなかった', 's-yomu'],
    ['飲みたい', 's-nomu'], ['行った', 's-iku'], ['行きません', 's-iku'], ['来ました', 's-kuru'],
    ['した', 's-suru'], ['高くなかった', 's-takai'], ['大きくて', 's-ookii']
  ])('understands the conjugation %s', (surface, id) => {
    const r = first(surface);
    expect(r?.words.map((w) => w.id)).toContain(id);
    expect(r?.length).toBe(Array.from(surface).length);
  });

  it('does not conjugate a word into a different part of speech', () => {
    // 猫 is a noun: 猫ました must not resolve to a verb 猫る
    expect(first('猫ました')?.words[0].id).toBe('s-neko');
    expect(first('猫ました')?.length).toBe(1);
  });

  it('returns null when nothing matches or the position is outside the text', () => {
    expect(first('xyz')).toBeNull();
    expect(first('猫', 5)).toBeNull();
    expect(first('猫', -1)).toBeNull();
  });
});
