import 'fake-indexeddb/auto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { buildPacks, makeDelta } from './packs-lib';
import { openDatabase, listCollection } from '../src/lib/db';
import { installPack } from '../src/lib/packs/install';
import { applyUpdates, checkContentUpdates } from '../src/lib/packs/updater';
import type { PackFile } from '../src/lib/packs/format';

const license = { name: 'CC0', url: 'https://example.org/l' };
const pack = (version: number, words: Record<string, unknown>[], extra: Partial<PackFile> = {}): PackFile => ({
  manifest: { format: 1, id: 'demo', kind: 'deck', title: 'Demo', version, license },
  upserts: { words: words as { id: string }[] }, ...extra
});

describe('makeDelta', () => {
  it('keeps only added/changed records and removed ids, ignoring key order', () => {
    const v1 = pack(1, [{ id: 'a', x: 1, y: 2 }, { id: 'b', x: 1 }, { id: 'c', x: 1 }]);
    const v2 = pack(2, [{ id: 'a', y: 2, x: 1 }, { id: 'b', x: 2 }, { id: 'd', x: 1 }]);
    const d = makeDelta(v1, v2);
    expect(d.manifest.base).toBe(1);
    expect(d.upserts!.words.map((r) => r.id)).toEqual(['b', 'd']);
    expect(d.deletes).toEqual({ words: ['c'] });
  });
  it('handles collections that appear or disappear', () => {
    const v1: PackFile = { ...pack(1, []), upserts: { old: [{ id: 'o' }] } };
    const v2: PackFile = { ...pack(2, []), upserts: { fresh: [{ id: 'f' }] } };
    const d = makeDelta(v1, v2);
    expect(d.upserts).toEqual({ fresh: [{ id: 'f' }] });
    expect(d.deletes).toEqual({ old: ['o'] });
  });
});

function srcWith(files: Record<string, unknown>) {
  const root = mkdtempSync(join(tmpdir(), 'packs-'));
  for (const [path, data] of Object.entries(files)) {
    mkdirSync(join(root, 'src', path.split('/')[0]), { recursive: true });
    writeFileSync(join(root, 'src', path), JSON.stringify(data));
  }
  return { src: join(root, 'src'), out: join(root, 'out') };
}

describe('buildPacks', () => {
  it('writes the newest full pack, one delta per release, and a catalog with correct checksums', () => {
    const { src, out } = srcWith({
      'demo/v1.json': pack(1, [{ id: 'a' }]), 'demo/v2.json': pack(2, [{ id: 'a' }, { id: 'b' }]), 'demo/v3.json': pack(3, [{ id: 'b' }])
    });
    const cat = buildPacks(src, out);
    expect(cat.packs.map((e) => e.url).sort()).toEqual(['demo-v1-to-v2.delta.json', 'demo-v2-to-v3.delta.json', 'demo-v3.pack.json']);
    for (const e of cat.packs) {
      const bytes = readFileSync(join(out, e.url));
      expect(e.size).toBe(bytes.length);
      expect(e.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
  });

  it('explains mistakes in plain words', () => {
    expect(() => buildPacks(srcWith({ 'demo/v2.json': pack(3, []) }).src, join(tmpdir(), 'x1'))).toThrow(/phải là 2/);
    expect(() => buildPacks(srcWith({ 'other/v1.json': pack(1, []) }).src, join(tmpdir(), 'x2'))).toThrow(/trùng tên thư mục/);
    expect(() => buildPacks(srcWith({ 'demo/v1.json': { ...pack(1, []), manifest: { ...pack(1, []).manifest, license: undefined } } }).src, join(tmpdir(), 'x3'))).toThrow(/giấy phép/);
  });

  it('end to end: a phone on v1 reaches v3 through the published files, equal to a fresh v3 install', async () => {
    const { src, out } = srcWith({
      'demo/v1.json': pack(1, [{ id: 'a', t: 1 }, { id: 'b', t: 1 }]),
      'demo/v2.json': pack(2, [{ id: 'a', t: 2 }, { id: 'b', t: 1 }, { id: 'c', t: 1 }]),
      'demo/v3.json': pack(3, [{ id: 'a', t: 2 }, { id: 'c', t: 1 }, { id: 'd', t: 1 }])
    });
    buildPacks(src, out);
    const url = 'https://site.example/content/catalog.json';
    const serve = (async (u: string) => {
      try { return new Response(readFileSync(join(out, new URL(u).pathname.replace('/content/', '')))); }
      catch { return new Response('', { status: 404 }); }
    }) as unknown as typeof fetch;

    const phone = await openDatabase('e2e-phone');
    await installPack(phone, pack(1, [{ id: 'a', t: 1 }, { id: 'b', t: 1 }]));
    const plans = await checkContentUpdates(phone, url, '0.1.0', serve);
    await applyUpdates(phone, plans, url, { fetchFn: serve });

    const fresh = await openDatabase('e2e-fresh');
    await installPack(fresh, JSON.parse(readFileSync(join(out, 'demo-v3.pack.json'), 'utf8')));
    const sorted = async (db: typeof phone) => (await listCollection(db, 'words')).sort((x, y) => x.id.localeCompare(y.id));
    expect(await sorted(phone)).toEqual(await sorted(fresh));
    expect(await checkContentUpdates(phone, url, '0.1.0', serve)).toEqual([]);
  });
});
