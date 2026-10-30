import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { buildJitendexPack, convertRows, JITENDEX_LICENSE, sensesOfRow, textOf } from '../../../scripts/jitendex-convert.mjs';
import { buildPacks as buildCatalog } from '../../../scripts/packs-lib';
import { validatePack } from '../../lib/packs/format';
import { installPack, uninstallPack } from '../../lib/packs/install';
import { getRecord, getUserData, openDatabase } from '../../lib/db';
import { DATA_LICENSES } from './licenses';
import { groupSenses, jitendexGloss, parseSource, visibleSources } from './jitendex';
import { dict, loadDictionary, loadJitendex, setMeaningSource } from './state.svelte';
import { tagLabel } from './labels';
import { checkJitendex, installJitendex } from './jitendexPack';
import type { JitendexEntry } from './types';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Rows shaped like the real Yomitan term banks of jitendex-yomitan.zip: [term, reading, defTags, rules, score, defs, sequence, termTags].
const tag = (code: string, kind: string, text: string) => ({ tag: 'span', title: text, data: { class: 'tag', code, content: kind }, content: text });
const li = (t: string) => ({ tag: 'li', content: t });
const example = (ja: unknown, en: string) => ({
  tag: 'div', data: { content: 'extra-info' }, content: { tag: 'div', content: { tag: 'div', data: { class: 'extra-box', content: 'example-sentence' }, content: [
    { tag: 'div', data: { content: 'example-sentence-a' }, content: { tag: 'span', lang: 'ja', content: ja } },
    { tag: 'div', data: { content: 'example-sentence-b' }, content: [{ tag: 'span', lang: 'en', content: en }, { tag: 'span', data: { content: 'attribution-footnote' }, content: '[1]' }] }
  ] } }
});
const ruby = (base: string, rt: string) => ({ tag: 'ruby', content: [base, { tag: 'rt', content: rt }] });

// 猫: one group, one sense, with an example that carries furigana.
const cat = ['猫', 'ねこ', '★', '', 200, [{ type: 'structured-content', content: [
  { tag: 'div', data: { content: 'sense-group' }, content: [
    tag('n', 'part-of-speech-info', 'noun'),
    { tag: 'div', data: { content: 'sense' }, content: [{ tag: 'ul', data: { content: 'glossary' }, content: [li('cat'), li('feline')] }, example([ruby('猫', 'ねこ'), 'が', '好', 'きです。'], 'I like cats.')] }
  ] },
  { tag: 'div', data: { content: 'attribution' }, content: 'JMdict' }
] }], 1467640, ''];
// Same entry under its kana spelling: must not replace or duplicate the first row.
const catKana = ['ねこ', 'ねこ', '', '', 0, cat[5], 1467640, ''];
// かかる: numbered senses (<ol>), group tags, a sense note.
const kakaru = ['掛かる', 'かかる', '', 'v5', 100, [{ type: 'structured-content', content: { tag: 'ul', data: { content: 'sense-groups' }, content: [
  { tag: 'li', data: { content: 'sense-group' }, content: [
    tag('v5r', 'part-of-speech-info', '5-dan'), tag('vi', 'part-of-speech-info', 'intransitive'), tag('uk', 'misc-info', 'kana'),
    { tag: 'ol', content: [
      { tag: 'li', data: { content: 'sense' }, content: { tag: 'ul', data: { content: 'glossary' }, content: [li('to hang')] } },
      { tag: 'li', data: { content: 'sense' }, content: [{ tag: 'ul', data: { content: 'glossary' }, content: [li('to begin (a task)')] },
        { tag: 'div', data: { content: 'extra-info' }, content: { tag: 'div', content: { tag: 'div', data: { class: 'extra-box', content: 'sense-note' }, content: [
          { tag: 'div', data: { content: 'sense-note-label' }, content: 'Note' }, { tag: 'div', data: { content: 'sense-note-content' }, content: 'usu. ～にかかる' }] } } }] }
    ] }
  ] },
  { tag: 'li', data: { content: 'sense-group' }, content: [
    tag('aux-v', 'part-of-speech-info', 'aux'),
    { tag: 'div', data: { content: 'sense' }, content: { tag: 'ul', data: { content: 'glossary' }, content: [li('to have started to')] } }
  ] }
] } }], 1207590, ''];
// A redirect row (negative sequence, definitions is a list) and a row with no meaning at all.
const redirect = ['Ｎ響', '', 'old kanji form', '', -101, [{ type: 'structured-content', content: { tag: 'div', data: { content: 'redirect-glossary' }, content: ['⟶'] } }, ['x', ['redirected from Ｎ響']]], -1000130, ''];
const empty = ['空', 'から', '', '', 0, [{ type: 'structured-content', content: { tag: 'div', content: 'nothing' } }], 42, ''];
// A word of foreign origin, and an "Explanation"-only sense.
const wasei = ['ブルーデー', 'ブルーデー', '', '', 0, [{ type: 'structured-content', content: [{ tag: 'div', data: { content: 'sense-group' }, content: [
  tag('n', 'part-of-speech-info', 'noun'),
  { tag: 'div', data: { content: 'sense' }, content: [{ tag: 'ul', data: { content: 'glossary' }, content: li('days of one\'s menstrual period') },
    { tag: 'div', data: { content: 'extra-info' }, content: { tag: 'div', content: { tag: 'div', data: { class: 'extra-box', content: 'lang-source' }, content: [
      { tag: 'div', data: { content: 'lang-source-label' }, content: 'Source' },
      { tag: 'div', data: { content: 'lang-source-content' }, content: ['English: "blue day"', { tag: 'span', data: { content: 'lang-source-wasei' }, content: 'wasei' }] }] } } }] }
] }] }], 1114380, ''];
const explain = ['ヾ', 'ヾ', '', '', 0, [{ type: 'structured-content', content: [{ tag: 'div', data: { content: 'sense-group' }, content: [
  tag('unc', 'part-of-speech-info', 'unclass'),
  { tag: 'div', data: { content: 'sense' }, content: { tag: 'div', data: { content: 'extra-info' }, content: { tag: 'div', content: { tag: 'div', data: { class: 'extra-box', content: 'info-gloss' }, content: [
    { tag: 'div', data: { content: 'info-gloss-label' }, content: 'Explanation' }, { tag: 'div', data: { content: 'info-gloss-content' }, content: 'voiced repetition mark in katakana' }] } } } }
] }] }], 7, ''];
const rows = [cat, catKana, kakaru, redirect, empty, wasei, explain];

describe('Jitendex converter', () => {
  it('reads glosses, parts of speech, and an example without furigana or footnotes', () => {
    expect(sensesOfRow(cat)).toEqual([{ pos: ['n'], gloss: ['cat', 'feline'], ex: { ja: '猫が好きです。', en: 'I like cats.' } }]);
  });
  it('keeps numbered senses, group tags and usage notes; groups with their own parts of speech stay apart', () => {
    const senses = sensesOfRow(kakaru);
    expect(senses).toEqual([
      { pos: ['v5r', 'vi'], gloss: ['to hang'], tags: ['uk'] },
      { pos: ['v5r', 'vi'], gloss: ['to begin (a task)'], tags: ['uk'], note: ['usu. ～にかかる'] },
      { pos: ['aux-v'], gloss: ['to have started to'] }
    ]);
  });
  it('drops the "wasei" badge from the word origin and uses an Explanation box as the gloss when that is all there is', () => {
    expect(sensesOfRow(wasei)[0].lang).toBe('English: "blue day"');
    expect(sensesOfRow(explain)).toEqual([{ pos: ['unc'], gloss: ['voiced repetition mark in katakana'] }]);
  });
  it('makes one record per JMdict entry id and skips redirects and rows without meanings', () => {
    const recs = convertRows(rows);
    expect(recs.map((r) => r.id)).toEqual(['1467640', '1207590', '1114380', '7']);
    expect(recs[0].senses).toHaveLength(1);
  });
  it('plain text helper skips furigana', () => {
    expect(textOf([ruby('握', 'にぎ'), 'る'])).toBe('握る');
  });
  it('builds a valid pack that carries the CC BY-SA license and attribution', () => {
    const pack = buildJitendexPack({ rows, version: 3 });
    const valid = validatePack(pack);
    expect(valid.manifest).toMatchObject({ id: 'dict-jitendex', kind: 'dictionary', version: 3 });
    expect(valid.manifest.license).toEqual(JITENDEX_LICENSE);
    expect(valid.manifest.license.name).toMatch(/CC BY-SA 4\.0/);
    expect(valid.manifest.license.attribution).toMatch(/Stephen Kraus/);
    expect(valid.manifest.license.attribution).toMatch(/JMdict/);
  });
  it('is listed in the in-app licenses with an open license', () => {
    const j = DATA_LICENSES.find((l) => l.id === 'jitendex')!;
    expect(j).toMatchObject({ by: 'Stephen Kraus', license: 'CC BY-SA 4.0', url: 'https://jitendex.org' });
  });
});

describe('meaning sources', () => {
  const entry = convertRows(rows)[1] as JitendexEntry;
  it('defaults to both and ignores junk', () => {
    expect(parseSource(undefined)).toBe('both');
    expect(parseSource('nonsense')).toBe('both');
    expect(parseSource('jitendex')).toBe('jitendex');
  });
  it('shows what the learner picked, but never an empty popup', () => {
    expect(visibleSources('both', entry)).toEqual({ jmdict: true, jitendex: true });
    expect(visibleSources('jmdict', entry)).toEqual({ jmdict: true, jitendex: false });
    expect(visibleSources('jitendex', entry)).toEqual({ jmdict: false, jitendex: true });
    expect(visibleSources('jitendex', undefined)).toEqual({ jmdict: true, jitendex: false }); // pack missing or word not in Jitendex
    expect(visibleSources('both', undefined)).toEqual({ jmdict: true, jitendex: false });
  });
  it('groups consecutive senses with the same parts of speech and builds a short gloss', () => {
    const groups = groupSenses(entry.senses);
    expect(groups.map((g) => g.senses.length)).toEqual([2, 1]);
    expect(jitendexGloss(entry)).toBe('to hang; to begin (a task); to have started to');
    expect(jitendexGloss(entry, 1)).toBe('to hang');
  });
  it('labels known usage tags in Vietnamese and leaves unknown ones as they are', () => {
    expect(tagLabel('uk')).toBe('thường viết bằng kana');
    expect(tagLabel('zzz')).toBe('zzz');
  });
});

describe('Jitendex in the database', () => {
  it('is found by JMdict id once installed, remembers the chosen source, and goes away on uninstall', async () => {
    const db = await openDatabase('jitendex-1');
    await loadDictionary(db);
    expect(dict.hasJitendex).toBe(false);
    expect(await loadJitendex('1467640')).toBeUndefined();

    await installPack(db, buildJitendexPack({ rows, version: 1 }));
    await loadDictionary(db);
    expect(dict.hasJitendex).toBe(true);
    expect((await loadJitendex('1467640'))?.senses[0].gloss).toEqual(['cat', 'feline']);
    expect(await loadJitendex('999')).toBeUndefined();

    await setMeaningSource('jitendex');
    expect(await getUserData(db, 'dict.source')).toBe('jitendex');
    dict.source = 'both';
    await loadDictionary(db);
    expect(dict.source).toBe('jitendex');

    await uninstallPack(db, 'dict-jitendex');
    await loadDictionary(db);
    expect(dict.hasJitendex).toBe(false);
    expect(await getRecord(db, 'jitendex', '1467640')).toBeUndefined();
    expect(dict.source).toBe('jitendex'); // the preference survives; visibleSources falls back to JMdict
  });
});

describe('Jitendex download', () => {
  it('finds the pack in its own catalog, verifies and installs it, and later offers nothing new', async () => {
    const root = mkdtempSync(join(tmpdir(), 'jitendex-'));
    const src = join(root, 'src'); const out = join(root, 'out');
    mkdirSync(join(src, 'dict-jitendex'), { recursive: true });
    writeFileSync(join(src, 'dict-jitendex', 'v1.json'), JSON.stringify(buildJitendexPack({ rows, version: 1 })));
    buildCatalog(src, out);

    const base = 'https://example.test/content/jitendex/';
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const name = String(url).replace(base, '');
      try { return new Response(readFileSync(join(out, name)), { status: 200 }); } catch { return new Response('', { status: 404 }); }
    }) as unknown as typeof fetch;

    const db = await openDatabase('jitendex-2');
    const status = await checkJitendex(db, base + 'catalog.json', '1.0.0', fetchFn);
    expect(status).toMatchObject({ installed: undefined, available: 1 });
    expect(status.plan?.steps).toHaveLength(1);

    await installJitendex(db, status.plan!, base + 'catalog.json', '1.0.0', fetchFn);
    expect((await db.get('packs', 'dict-jitendex'))?.version).toBe(1);
    expect(await getRecord(db, 'jitendex', '1467640')).toBeTruthy();

    const again = await checkJitendex(db, base + 'catalog.json', '1.0.0', fetchFn);
    expect(again).toMatchObject({ installed: 1, available: 1, plan: undefined });
  });

  it('reports a failed download in plain words and installs nothing', async () => {
    const db = await openDatabase('jitendex-3');
    const plan = { id: 'dict-jitendex', from: 0, to: 1, bytes: 1, steps: [{ id: 'dict-jitendex', version: 1, url: 'dict-jitendex.v1.json', sha256: 'a'.repeat(64), size: 1 }] };
    const fetchFn = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    await expect(installJitendex(db, plan, 'https://example.test/c/catalog.json', '1.0.0', fetchFn)).rejects.toThrow(/HTTP 500/);
    expect(await db.get('packs', 'dict-jitendex')).toBeUndefined();
  });
});
