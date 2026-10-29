import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import { loadCards } from './store';
import { buildQueue } from './session';
import { DEFAULT_SETTINGS, emptyStats } from './types';
import { addWordToSrs, cardIdFor, hasSrsCard, syncAnimeCards } from './bridge';
import { buildIndex, tokenize } from '../anime/tokenizer';
import { parseSubtitles } from '../anime/subtitles';
import { planCards, saveNewCards, tokenizeCues } from '../anime/store';

const neko = { wordId: 'neko', word: '猫', reading: 'ねこ', meaning: 'cat', kind: 'dictionary' as const };

describe('adding words to the SRS', () => {
  it('makes a card the SRS can load and queue', async () => {
    const db = await openDatabase('bridge-1');
    expect(await addWordToSrs(db, neko)).toBe(true);
    const cards = await loadCards(db);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ id: 'word:neko', word: '猫', reading: 'ねこ', meaning: 'cat' });
    const queue = buildQueue({ cards, states: new Map(), settings: DEFAULT_SETTINGS, stats: emptyStats(), now: 0 });
    expect(queue).toEqual(['word:neko']);
    expect(await hasSrsCard(db, cardIdFor('dictionary', 'neko'))).toBe(true);
  });

  it('does not duplicate, keeps earlier cards, and survives parallel adds', async () => {
    const db = await openDatabase('bridge-2');
    await Promise.all([
      addWordToSrs(db, neko),
      addWordToSrs(db, { ...neko, wordId: 'inu', word: '犬', reading: 'いぬ', meaning: 'dog' }),
      addWordToSrs(db, { ...neko, wordId: 'hon', word: '本', reading: 'ほん', meaning: 'book' })
    ]);
    expect(await addWordToSrs(db, neko)).toBe(false);
    expect((await loadCards(db)).map((c) => c.id).sort()).toEqual(['word:hon', 'word:inu', 'word:neko']);
  });

  it('turns a sentence into a fill-in-the-blank example, using the conjugated form when it is what the sentence has', async () => {
    const db = await openDatabase('bridge-3');
    await addWordToSrs(db, { wordId: 'yomu', word: '読む', reading: 'よむ', meaning: 'to read', kind: 'manga', origin: 'Vol 1', sentence: '本を読んだ。', blank: '読んだ' });
    await addWordToSrs(db, { wordId: 'neko', word: '猫', reading: 'ねこ', meaning: 'cat', kind: 'anime', sentence: '犬が走る。' }); // word not in sentence
    const cards = await loadCards(db);
    expect(cards.find((c) => c.id === 'word:yomu')?.example).toEqual({ ja: '本を読んだ。', blank: '読んだ' });
    expect(cards.find((c) => c.id === 'anime:neko')?.example).toBeUndefined();
  });

  it('leaves other packs and review history alone', async () => {
    const db = await openDatabase('bridge-4');
    await installPack(db, { manifest: { format: 1, id: 'other', kind: 'deck', title: 'x', version: 1, license: { name: 'CC0', url: 'https://x.org' } }, upserts: { cards: [{ id: 'c1', word: 'a', reading: 'a', meaning: 'a' }] } });
    await db.put('userdata', { cardId: 'word:neko', due: 1 }, 'srs.state:word:neko');
    await addWordToSrs(db, neko);
    await addWordToSrs(db, { ...neko, wordId: 'inu', word: '犬', reading: 'いぬ', meaning: 'dog' });
    expect((await loadCards(db)).map((c) => c.id).sort()).toEqual(['c1', 'word:inu', 'word:neko']);
    expect(await db.get('userdata', 'srs.state:word:neko')).toEqual({ cardId: 'word:neko', due: 1 });
  });
});

describe('anime subtitle cards reach the SRS', () => {
  const index = buildIndex([
    { id: 'neko', kanji: '猫', reading: 'ねこ', meaning: 'con mèo' },
    { id: 'yomu', kanji: '読む', reading: 'よむ', meaning: 'đọc' }
  ]);
  const srt = '1\n00:00:01,000 --> 00:00:02,000\n猫は本を読む。\n';

  it('saveNewCards copies new subtitle cards into the cards collection, once', async () => {
    const db = await openDatabase('bridge-5');
    const lines = tokenizeCues(parseSubtitles(srt), index, tokenize);
    await saveNewCards(db, planCards(lines, new Set(), [], 'ep1.srt'));
    const cards = await loadCards(db);
    expect(cards.map((c) => c.id).sort()).toEqual(['anime:neko', 'anime:yomu']);
    expect(cards.find((c) => c.id === 'anime:neko')).toMatchObject({ word: '猫', reading: 'ねこ', meaning: 'con mèo', example: { ja: '猫は本を読む。', blank: '猫' } });
    expect(await syncAnimeCards(db)).toBe(0); // nothing new the second time
  });

  it('picks up cards that were saved before the link existed', async () => {
    const db = await openDatabase('bridge-6');
    await db.put('userdata', [{ id: 'anime:neko', word: '猫', reading: 'ねこ', meaning: 'con mèo', sentence: '猫だ', source: 'a.srt', createdAt: 5 }], 'anime.cards');
    expect(await syncAnimeCards(db)).toBe(1);
    expect((await loadCards(db))[0].id).toBe('anime:neko');
  });

  it('a word added from the dictionary popup while watching is the same card as the one made from the file', async () => {
    const db = await openDatabase('bridge-7');
    await addWordToSrs(db, { wordId: 'neko', word: '猫', reading: 'ねこ', meaning: 'cat', kind: 'anime', sentence: '猫だ' });
    const lines = tokenizeCues(parseSubtitles(srt), index, tokenize);
    await saveNewCards(db, planCards(lines, new Set(), [], 'ep1.srt'));
    expect((await loadCards(db)).filter((c) => c.id === 'anime:neko')).toHaveLength(1);
  });
});
