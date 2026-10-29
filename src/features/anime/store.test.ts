import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../lib/db';
import { parseSubtitles } from './subtitles';
import { buildIndex, tokenize } from './tokenizer';
import { loadCards, loadKnown, planCards, saveKnown, saveNewCards, tokenizeCues } from './store';

const index = buildIndex([
  { id: 'neko', kanji: '猫', reading: 'ねこ', meaning: 'con mèo' },
  { id: 'hon', kanji: '本', reading: 'ほん', meaning: 'quyển sách' },
  { id: 'yomu', kanji: '読む', reading: 'よむ', meaning: 'đọc' }
]);
const srt = '1\n00:00:01,000 --> 00:00:02,000\n猫は本を読む。\n\n2\n00:00:03,000 --> 00:00:04,000\n猫は走る。\n';
const lines = () => tokenizeCues(parseSubtitles(srt), index, tokenize);

describe('card creation from subtitles', () => {
  it('creates cards only for unknown words that have a meaning, most frequent first', () => {
    const plan = planCards(lines(), new Set(['hon']), [], 'ep1.srt', 123);
    expect(plan.cards.map((c) => c.id)).toEqual(['anime:neko', 'anime:yomu']);
    expect(plan.cards[0]).toMatchObject({ word: '猫', reading: 'ねこ', meaning: 'con mèo', sentence: '猫は本を読む。', source: 'ep1.srt' });
    expect(plan.skippedNoMeaning).toBe(1); // 走る is not in the dictionary
  });
  it('does not duplicate existing cards and respects the limit', () => {
    const first = planCards(lines(), new Set(), [], 'a.srt');
    expect(planCards(lines(), new Set(), first.cards, 'a.srt').cards).toEqual([]);
    expect(planCards(lines(), new Set(), [], 'a.srt', 0, 1).cards).toHaveLength(1);
  });
  it('persists known words and cards in userdata', async () => {
    const db = await openDatabase('anime-test');
    await saveKnown(db, new Set(['neko']));
    expect([...(await loadKnown(db))]).toEqual(['neko']);
    expect(await saveNewCards(db, planCards(lines(), new Set(), [], 'a.srt'))).toBe(3);
    expect(await loadCards(db)).toHaveLength(3);
    db.close();
  });
});
