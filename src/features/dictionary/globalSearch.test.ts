import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, setUserData, type DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import { clearSearchSources, dictionarySource, registerSearchSource, searchAll, userContentSource } from './globalSearch';
import { sampleIndex } from './fixtures';

let db: DB;
let n = 0;
beforeEach(async () => {
  db = await openDatabase(`gs-${n++}`);
  clearSearchSources();
  const idx = sampleIndex();
  registerSearchSource(dictionarySource(() => idx));
  registerSearchSource(userContentSource(db));
});

describe('searchAll', () => {
  it('shows dictionary results and the learner\'s own cards and notes together', async () => {
    await setUserData(db, 'card:1', { front: '猫', back: 'mèo - con vật nuôi' });
    await setUserData(db, 'note:7', { title: 'Mẹo nhớ', text: 'Chữ 猫 có bộ thú bên trái' });
    await setUserData(db, 'note:8', { title: 'Không liên quan', text: 'ngữ pháp は và が' });
    const r = await searchAll('猫');
    expect(r.dictionary.map((h) => h.id)).toContain('s-neko');
    expect(r.user.map((h) => `${h.kind}:${h.id}`).sort()).toEqual(['card:1', 'note:7']);
    expect(r.user.find((h) => h.id === '1')?.subtitle).toBe('mèo - con vật nuôi');
  });

  it('finds user items by Vietnamese text and tags, ignoring case and accents of kana', async () => {
    await setUserData(db, 'note:1', { title: 'Ghi chú', text: 'Động từ nhóm 1', tags: ['Ngữ pháp'] });
    expect((await searchAll('ngữ pháp')).user).toHaveLength(1);
    expect((await searchAll('NHÓM 1')).user).toHaveLength(1);
  });

  it('also searches cards that came with a deck pack, but not other collections', async () => {
    await installPack(db, {
      manifest: { format: 1, id: 'deck', kind: 'deck', title: 'Deck', version: 1, license: { name: 'CC0', url: 'https://x.test' } },
      upserts: { cards: [{ id: 'c1', front: '猫', back: 'cat' }], lessons: [{ id: 'l1', front: '猫' }] }
    });
    const r = await searchAll('猫');
    expect(r.user.map((h) => h.id)).toEqual(['c1']);
  });

  it('keeps working when there is nothing to find or no dictionary is installed', async () => {
    expect(await searchAll('zzzz')).toEqual({ dictionary: [], user: [], other: [] });
    clearSearchSources();
    registerSearchSource(dictionarySource(() => undefined));
    expect((await searchAll('猫')).dictionary).toEqual([]);
  });

  it('lets other features add their own source', async () => {
    registerSearchSource({ id: 'manga', label: 'Manga', search: () => [{ source: 'manga', kind: 'note', id: 'm1', title: '猫', subtitle: '', score: 5 }] });
    expect((await searchAll('猫')).other.map((h) => h.id)).toEqual(['m1']);
  });
});
