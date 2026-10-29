import { describe, it, expect } from 'vitest';
import { kataToHira, normalize, romajiToHiragana } from './kana';

describe('romajiToHiragana', () => {
  it.each([
    ['neko', 'ねこ'], ['nihongo', 'にほんご'], ['gakkou', 'がっこう'], ['shizuka', 'しずか'], ['kyou', 'きょう'],
    ['konnichiha', 'こんにちは'], ['tabemasu', 'たべます'], ['sensei', 'せんせい'], ['chotto', 'ちょっと'], ['n', 'ん'],
    ['tōkyō', 'とうきょう']
  ])('%s -> %s', (romaji, kana) => expect(romajiToHiragana(romaji)).toBe(kana));

  it('returns null for text that is not romaji, so English words are not treated as readings', () => {
    expect(romajiToHiragana('cat')).toBeNull();
    expect(romajiToHiragana('to read')).toBeNull();
    expect(romajiToHiragana('')).toBeNull();
  });
});

describe('normalize', () => {
  it('treats katakana, half-width kana and case alike', () => {
    expect(kataToHira('ネコ')).toBe('ねこ');
    expect(normalize('ﾈｺ')).toBe('ねこ');
    expect(normalize(' Neko ')).toBe('neko');
  });
});
