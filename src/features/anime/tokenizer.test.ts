import { describe, expect, it } from 'vitest';
import { deinflect } from './deinflect';
import { comprehension } from './comprehension';
import { buildIndex, tokenize } from './tokenizer';

const index = buildIndex([
  { id: 'neko', kanji: '猫', reading: 'ねこ', meaning: 'con mèo' },
  { id: 'hon', kanji: '本', reading: 'ほん', meaning: 'quyển sách' },
  { id: 'yomu', kanji: '読む', reading: 'よむ', meaning: 'đọc' },
  { id: 'taberu', kanji: '食べる', reading: 'たべる', meaning: 'ăn' },
  { id: 'takai', kanji: '高い', reading: 'たかい', meaning: 'cao, đắt' }
]);

describe('deinflect', () => {
  it('recovers dictionary forms', () => {
    expect(deinflect('食べました')).toContain('食べる');
    expect(deinflect('読んだ')).toContain('読む');
    expect(deinflect('高くなかった')).toContain('高い');
    expect(deinflect('猫')).toEqual(['猫']);
  });
});

describe('tokenizer', () => {
  it('matches dictionary words, including inflected ones', () => {
    const t = tokenize('猫は本を読んだ。', index);
    expect(t.filter((x) => x.entry).map((x) => [x.surface, x.entry!.id])).toEqual([
      ['猫', 'neko'], ['本', 'hon'], ['読んだ', 'yomu']
    ]);
  });
  it('keeps unknown words and marks punctuation / particles as not countable', () => {
    const t = tokenize('猫は走る。', index);
    expect(t.map((x) => x.surface).join('')).toBe('猫は走る。');
    expect(t.find((x) => x.surface === '。')!.countable).toBe(false);
    expect(t.find((x) => x.surface === 'は')!.countable).toBe(false);
    const run = t.find((x) => x.surface.includes('走'))!;
    expect(run.countable).toBe(true);
    expect(run.entry).toBeUndefined();
  });
  it('never loses or duplicates characters', () => {
    const s = '食べました、高くなかったよ！ABC 123';
    expect(tokenize(s, index).map((x) => x.surface).join('')).toBe(s);
  });
});

describe('comprehension score', () => {
  const lines = [tokenize('猫は本を読んだ。', index), tokenize('猫は走る。', index)];
  it('counts every occurrence by default', () => {
    // countable words: 猫 本 読んだ 猫 走る = 5; known 猫 本 猫 = 3
    const s = comprehension(lines, new Set(['neko', 'hon']));
    expect(s).toMatchObject({ known: 3, total: 5, percent: 60 });
    expect(s.unknownKeys).toContain('yomu');
  });
  it('can count distinct words only', () => {
    const s = comprehension(lines, new Set(['neko', 'hon']), true);
    expect(s).toMatchObject({ known: 2, total: 4, percent: 50 });
  });
  it('is 100% when nothing is unknown', () => {
    expect(comprehension([tokenize('猫', index)], new Set(['neko'])).percent).toBe(100);
  });
});
