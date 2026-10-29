import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { buildPacks } from '../../../scripts/dict-convert.mjs';
import { installPack } from '../../lib/packs/install';
import { openDatabase, listCollection } from '../../lib/db';
import { downloadDictionary, hasRealDictionary, planDictionaryDownload, SAMPLE_PACK_ID } from './download';
import { samplePack } from './fixtures';
import { DictionaryIndex } from './index';
import type { Word } from './types';

const jmdict = { words: [{ id: '1467640', kanji: [{ common: true, text: '猫' }], kana: [{ common: true, text: 'ねこ' }],
  sense: [{ partOfSpeech: ['n'], gloss: [{ lang: 'eng', text: 'cat' }], examples: [{ source: { type: 'tatoeba', value: '1' }, sentences: [{ land: 'jpn', text: '猫だ。' }, { land: 'eng', text: 'A cat.' }] }] }] }] };
const kanjidic = { characters: [{ literal: '猫', misc: { strokeCounts: [11] }, readingMeaning: { groups: [{ readings: [{ type: 'ja_kun', value: 'ねこ' }], meanings: [{ lang: 'en', value: 'cat' }] }] } }] };

/** A fake server: catalog + pack files, with real checksums. */
function server() {
  const files = new Map<string, string>();
  const packs = [...Object.values(buildPacks({ jmdict, kanjidic, version: 1 })), { manifest: { format: 1, id: 'kana-core', kind: 'kana', title: 'Kana', version: 1, license: { name: 'CC0', url: 'https://x.test' } }, upserts: { kana: [{ id: 'a' }] } }] as any[];
  const entries = packs.map((p) => {
    const body = JSON.stringify(p), url = `${p.manifest.id}-v1.pack.json`;
    files.set(url, body);
    return { id: p.manifest.id, version: 1, url, sha256: createHash('sha256').update(body).digest('hex'), size: body.length };
  });
  files.set('catalog.json', JSON.stringify({ format: 1, generatedAt: '', packs: entries }));
  const fetchFn = (async (u: string) => {
    const body = files.get(new URL(u).pathname.split('/').pop()!);
    return body === undefined ? new Response('', { status: 404 }) : new Response(body);
  }) as unknown as typeof fetch;
  return { fetchFn, files };
}
const CATALOG = 'https://example.test/content/catalog.json';
let n = 0;

describe('downloadDictionary', () => {
  it('downloads only the dictionary packs, replaces the sample, and the result is searchable', async () => {
    const db = await openDatabase(`dl-${n++}`);
    await installPack(db, samplePack);
    const { fetchFn } = server();
    const plan = await planDictionaryDownload(db, CATALOG, fetchFn);
    expect(plan.plans.map((p) => p.id).sort()).toEqual(['jmdict-examples', 'jmdict-words', 'kanjidic']); // not kana-core
    expect(plan.bytes).toBeGreaterThan(0);

    const { results } = await downloadDictionary(db, undefined, CATALOG, fetchFn);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await hasRealDictionary(db)).toBe(true);
    expect(await db.get('packs', SAMPLE_PACK_ID)).toBeUndefined();
    expect(await db.get('packs', 'kana-core')).toBeUndefined();
    const words = (await listCollection(db, 'words')) as unknown as Word[];
    expect(words.map((w) => w.id)).toEqual(['1467640']);
    expect(new DictionaryIndex(words).search('cat')[0].word.id).toBe('1467640');
    expect(await listCollection(db, 'kanji')).toHaveLength(1);
    expect(await listCollection(db, 'examples')).toHaveLength(1);
  });

  it('keeps the sample and reports the problem when a download fails or is corrupted', async () => {
    const db = await openDatabase(`dl-${n++}`);
    await installPack(db, samplePack);
    const { fetchFn, files } = server();
    files.set('jmdict-words-v1.pack.json', files.get('jmdict-words-v1.pack.json')! + ' '); // checksum no longer matches
    const { results } = await downloadDictionary(db, undefined, CATALOG, fetchFn);
    expect(results.find((r) => r.id === 'jmdict-words')?.ok).toBe(false);
    expect(await db.get('packs', SAMPLE_PACK_ID)).toBeDefined();
    expect(await hasRealDictionary(db)).toBe(false);
  });

  it('does nothing once the packs are up to date', async () => {
    const db = await openDatabase(`dl-${n++}`);
    const { fetchFn } = server();
    await downloadDictionary(db, undefined, CATALOG, fetchFn);
    expect((await planDictionaryDownload(db, CATALOG, fetchFn)).plans).toEqual([]);
  });
});
