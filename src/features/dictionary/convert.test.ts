import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { buildJlptMap, buildPacks, convertKanji, convertWord, LICENSES, parseJlptCsv } from '../../../scripts/dict-convert.mjs';
import { validatePack } from '../../lib/packs/format';
import { installPack } from '../../lib/packs/install';
import { openDatabase } from '../../lib/db';
import { DictionaryIndex } from './index';
import { DATA_LICENSES } from './licenses';
import type { Word } from './types';

// Shaped like jmdict-simplified output ("land" is the field's real, misspelled name in that format).
const jmdict = {
  words: [
    {
      id: '1467640',
      kanji: [{ common: true, text: '猫', tags: [] }],
      kana: [{ common: true, text: 'ねこ', tags: [], appliesToKanji: ['*'] }, { common: false, text: 'ネコ', tags: [], appliesToKanji: ['*'] }],
      sense: [{
        partOfSpeech: ['n'], appliesToKanji: ['*'], appliesToKana: ['*'], related: [['犬', 1]], antonym: [],
        gloss: [{ lang: 'eng', text: 'cat' }, { lang: 'eng', text: 'feline' }, { lang: 'ger', text: 'Katze' }],
        examples: [{ source: { type: 'tatoeba', value: '100' }, text: '猫', sentences: [{ land: 'jpn', text: '猫が好きです。' }, { land: 'eng', text: 'I like cats.' }] }]
      }]
    },
    { id: '2', kanji: [{ common: false, text: '稀猫' }], kana: [{ common: false, text: 'まれねこ' }], sense: [{ partOfSpeech: ['n'], gloss: [{ lang: 'eng', text: 'rare cat' }] }] },
    { id: '3', kanji: [], kana: [{ common: true, text: 'ありがとう' }], sense: [{ partOfSpeech: ['int'], gloss: [{ lang: 'eng', text: 'thank you' }],
      examples: [{ source: { type: 'tatoeba', value: '100' }, text: 'x', sentences: [{ land: 'jpn', text: '猫が好きです。' }, { land: 'eng', text: 'I like cats.' }] }] }] }
  ]
};
const kanjidic = {
  characters: [{
    literal: '猫', misc: { grade: 8, strokeCounts: [11], frequency: 1830, jlptLevel: undefined },
    readingMeaning: { groups: [{ readings: [{ type: 'ja_on', value: 'ビョウ' }, { type: 'ja_kun', value: 'ねこ' }, { type: 'pinyin', value: 'mao1' }],
      meanings: [{ lang: 'en', value: 'cat' }, { lang: 'fr', value: 'chat' }] }] }
  }]
};

describe('convertWord', () => {
  it('keeps English glosses, forms, cross-references and examples', () => {
    const { word, examples } = convertWord(jmdict.words[0]);
    expect(word).toMatchObject({ id: '1467640', common: true, ex: ['tat-100'] });
    expect(word.senses[0].gloss).toEqual(['cat', 'feline']);
    expect(word.senses[0].related).toEqual(['犬']);
    expect(word.kana[0].kanji).toBeUndefined(); // "*" means every spelling
    expect(examples).toEqual([{ id: 'tat-100', ja: '猫が好きです。', en: 'I like cats.', words: ['1467640'] }]);
  });

  it('adds JLPT level and frequency rank when lists are given', () => {
    const jlpt = buildJlptMap([...parseJlptCsv('expression,reading,meaning,tags\n猫,ねこ,cat,\n', 5), ...parseJlptCsv('expression,reading,meaning,tags\n猫,ねこ,cat,\n', 3)]);
    const { word } = convertWord(jmdict.words[0], { jlpt, rankOf: (t) => (t === 'ねこ' ? 2500 : undefined) });
    expect(word.jlpt).toBe(5); // easiest level wins when a word is listed twice
    expect(word.rank).toBe(2500);
  });
});

describe('parseJlptCsv', () => {
  it('handles quoted commas and skips blank lines', () => {
    const rows = parseJlptCsv('expression,reading,meaning,tags\n"猫",ねこ,"cat, kitty",x\n\n本,ほん,book,\n', 5);
    expect(rows).toEqual([{ expression: '猫', reading: 'ねこ', level: 5 }, { expression: '本', reading: 'ほん', level: 5 }]);
  });
});

describe('convertKanji', () => {
  it('splits on/kun readings and keeps only English meanings', () => {
    expect(convertKanji(kanjidic.characters[0])).toEqual({ id: '猫', on: ['ビョウ'], kun: ['ねこ'], meanings: ['cat'], strokes: 11, grade: 8, freq: 1830 });
  });
});

describe('buildPacks', () => {
  const packs = buildPacks({ jmdict, kanjidic, version: 3 });

  it('builds three valid packs, common words only by default, with examples de-duplicated', () => {
    expect(Object.keys(packs).sort()).toEqual(['jmdict-examples', 'jmdict-words', 'kanjidic']);
    for (const p of Object.values(packs)) validatePack(p);
    expect(packs['jmdict-words'].upserts.words.map((w: Word) => w.id)).toEqual(['1467640', '3']);
    expect(packs['jmdict-examples'].upserts.examples).toHaveLength(1);
    expect(packs['jmdict-examples'].upserts.examples[0].words).toEqual(['1467640', '3']);
    expect(buildPacks({ jmdict, version: 1, commonOnly: false })['jmdict-words'].upserts.words).toHaveLength(3);
  });

  it('declares an open license with attribution on every pack, and each one is listed in the app', () => {
    const listed = new Set(DATA_LICENSES.map((l) => l.licenseUrl));
    for (const p of Object.values(packs) as any[]) {
      expect(p.manifest.license.attribution).toBeTruthy();
      expect(listed.has(p.manifest.license.url)).toBe(true);
    }
    expect(Object.values(LICENSES).every((l) => l.url.startsWith('https://'))).toBe(true);
  });

  it('installs, is searchable offline, and re-installing a newer version replaces it', async () => {
    const db = await openDatabase('convert-install');
    for (const p of Object.values(packs)) await installPack(db, p);
    const words = (await db.getAllFromIndex('records', 'byCollection', 'words')).map((r) => r.data) as unknown as Word[];
    expect(new DictionaryIndex(words).search('cat')[0].word.id).toBe('1467640');
    await installPack(db, buildPacks({ jmdict, version: 4 })['jmdict-words']);
    expect((await db.getAllFromIndex('records', 'byCollection', 'words'))).toHaveLength(2);
  });
});
