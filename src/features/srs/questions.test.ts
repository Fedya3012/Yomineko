import { describe, it, expect } from 'vitest';
import { availableTypes, chooseType, hasKanji, makeQuestion, BLANK_MARK } from './questions';
import type { CardContent } from './types';

const cards: CardContent[] = [
  { id: 'neko', word: '猫', reading: 'ねこ', meaning: 'con mèo', example: { ja: '猫が好きです。', blank: '猫' } },
  { id: 'hon', word: '本', reading: 'ほん', meaning: 'quyển sách' },
  { id: 'yomu', word: '読む', reading: 'よむ', meaning: 'đọc' },
  { id: 'inu', word: '犬', reading: 'いぬ', meaning: 'con chó' },
  { id: 'arigato', word: 'ありがとう', reading: 'ありがとう', meaning: 'cảm ơn' }
];
const seeded = () => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); };

describe('question types', () => {
  it('detects kanji', () => { expect(hasKanji('猫')).toBe(true); expect(hasKanji('ねこ')).toBe(false); });
  it('kana-only words get no audio-to-kanji or handwriting question', () => {
    expect(availableTypes(cards[4])).toEqual(['meaning']);
    expect(availableTypes(cards[0])).toEqual(['meaning', 'audio', 'handwrite', 'blank']);
  });
  it('rotates types between reviews and respects settings', () => {
    const seen = new Set([0, 1, 2, 3].map((r) => chooseType(cards[0], r, ['meaning', 'audio', 'handwrite', 'blank'])));
    expect(seen.size).toBe(4);
    expect(chooseType(cards[0], 5, ['audio'])).toBe('audio');
    expect(chooseType(cards[1], 0, ['blank'])).toBe('recall');
  });
});

describe('makeQuestion', () => {
  it('meaning: correct answer is among 4 unique choices', () => {
    const q = makeQuestion(cards[0], 'meaning', cards, seeded());
    if (q.type !== 'meaning') throw new Error('wrong type');
    expect(q.choices).toHaveLength(4);
    expect(new Set(q.choices).size).toBe(4);
    expect(q.choices[q.answer]).toBe('con mèo');
  });
  it('audio: choices are kanji words', () => {
    const q = makeQuestion(cards[2], 'audio', cards, seeded());
    if (q.type !== 'audio') throw new Error('wrong type');
    expect(q.choices[q.answer]).toBe('読む');
  });
  it('blank: sentence hides the word', () => {
    const q = makeQuestion(cards[0], 'blank', cards, seeded());
    if (q.type !== 'blank') throw new Error('wrong type');
    expect(q.sentence).toBe(`${BLANK_MARK}が好きです。`);
    expect(q.choices[q.answer]).toBe('猫');
  });
  it('handwrite needs no choices', () => {
    expect(makeQuestion(cards[0], 'handwrite', cards).type).toBe('handwrite');
  });
  it('falls back to recall when there are not enough other cards', () => {
    expect(makeQuestion(cards[0], 'meaning', [cards[0]]).type).toBe('recall');
  });
});
