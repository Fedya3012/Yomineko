import { describe, it, expect } from 'vitest';
import { isCorrect, makeQuestions, pickDistractors, seededRandom, shuffle, summarizeDrill } from './drills';
import type { Kana } from './types';

const mk = (char: string, romaji: string, row: string): Kana =>
  ({ id: `hira:${char}`, char, script: 'hiragana', romaji, row, kind: 'basic', strokes: ['M0,0 l1,1'] });
const POOL = [
  mk('あ', 'a', 'a'), mk('い', 'i', 'a'), mk('う', 'u', 'a'), mk('え', 'e', 'a'), mk('お', 'o', 'a'),
  mk('か', 'ka', 'ka'), mk('き', 'ki', 'ka'), mk('く', 'ku', 'ka'), mk('じ', 'ji', 'za'), mk('ぢ', 'ji', 'da')
];

describe('seededRandom / shuffle', () => {
  it('cùng hạt giống cho cùng kết quả', () => {
    expect(shuffle(POOL, seededRandom(7)).map((k) => k.char)).toEqual(shuffle(POOL, seededRandom(7)).map((k) => k.char));
  });
  it('xáo trộn không mất phần tử', () => {
    expect(shuffle(POOL, seededRandom(1)).sort((a, b) => a.id.localeCompare(b.id))).toEqual([...POOL].sort((a, b) => a.id.localeCompare(b.id)));
  });
});

describe('pickDistractors', () => {
  it('không chọn chính nó và không có hai lựa chọn cùng cách đọc', () => {
    for (let seed = 0; seed < 30; seed++) {
      const out = pickDistractors(POOL[5], POOL, 3, seededRandom(seed));
      expect(out).toHaveLength(3);
      expect(out.some((k) => k.id === POOL[5].id)).toBe(false);
      expect(new Set(out.map((k) => k.romaji)).size).toBe(3);
    }
  });
  it('loại chữ trùng cách đọc với đáp án (じ/ぢ)', () => {
    const out = pickDistractors(POOL[8], POOL, 5, seededRandom(3));
    expect(out.some((k) => k.char === 'ぢ')).toBe(false);
  });
});

describe('makeQuestions', () => {
  it('tạo đủ số câu, mỗi câu có đáp án đúng và 4 lựa chọn khác nhau', () => {
    const qs = makeQuestions(POOL, 20, 'listen', seededRandom(5));
    expect(qs).toHaveLength(20);
    for (const q of qs) {
      expect(q.choices).toHaveLength(4);
      expect(q.choices.filter((c) => isCorrect(q, c.id))).toHaveLength(1);
      expect(new Set(q.choices.map((c) => c.romaji)).size).toBe(4);
    }
  });
  it('không hỏi cùng một chữ hai lần liên tiếp', () => {
    const qs = makeQuestions(POOL, 40, 'char-to-romaji', seededRandom(9));
    qs.slice(1).forEach((q, i) => expect(q.target.id).not.toBe(qs[i].target.id));
  });
  it('chữ yếu xuất hiện nhiều hơn', () => {
    const weak = new Set(['hira:か']);
    const count = (set: ReadonlySet<string>) =>
      makeQuestions(POOL, 60, 'romaji-to-char', seededRandom(2), set).filter((q) => q.target.id === 'hira:か').length;
    expect(count(weak)).toBeGreaterThan(count(new Set()));
  });
  it('báo lỗi nếu có quá ít chữ', () => {
    expect(() => makeQuestions(POOL.slice(0, 3), 5, 'listen')).toThrow();
  });
});

describe('summarizeDrill', () => {
  it('tính độ chính xác, thời gian trung bình và các chữ yếu', () => {
    const s = summarizeDrill([
      { id: 'a', correct: true, ms: 1000 }, { id: 'b', correct: false, ms: 3000 }, { id: 'b', correct: false, ms: 2000 }, { id: 'c', correct: true, ms: 2000 }
    ]);
    expect(s).toEqual({ total: 4, correct: 2, accuracy: 0.5, avgMs: 2000, weak: ['b'] });
  });
  it('rỗng thì không chia cho 0', () => {
    expect(summarizeDrill([])).toEqual({ total: 0, correct: 0, accuracy: 0, avgMs: 0, weak: [] });
  });
});
