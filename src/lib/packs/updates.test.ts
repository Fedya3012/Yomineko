import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, listCollection, getUserData, setUserData, type DB } from '../db';
import { installPack, planUpdates } from './install';
import { applyUpdates, checkContentUpdates } from './updater';
import { validateCatalog, type Catalog, type CatalogEntry, type PackFile } from './format';

const license = { name: 'CC0', url: 'https://example.org/l' };
const full = (version: number, ids: string[], extra = {}): PackFile => ({
  manifest: { format: 1, id: 'demo', kind: 'deck', title: 'Demo', version, license, ...extra },
  upserts: { words: ids.map((id) => ({ id, text: `${id}@${version}` })) }
});
const delta = (base: number, version: number, add: string[], del: string[] = []): PackFile => ({
  manifest: { ...full(version, []).manifest, base },
  upserts: { words: add.map((id) => ({ id, text: `${id}@${version}` })) }, deletes: del.length ? { words: del } : undefined
});

const URL_BASE = 'https://cdn.example.org/content/catalog.json';
/** A fake server: serves pack files by name and counts requests. */
function server(files: Record<string, PackFile | string>) {
  const hits: string[] = [];
  const bytes = (f: PackFile | string) => Buffer.from(typeof f === 'string' ? f : JSON.stringify(f));
  const entry = (url: string, pack: PackFile, over: Partial<CatalogEntry> = {}): CatalogEntry => ({
    id: pack.manifest.id, version: pack.manifest.version, base: pack.manifest.base, url,
    sha256: createHash('sha256').update(bytes(files[url])).digest('hex'), size: bytes(files[url]).length,
    minAppVersion: pack.manifest.minAppVersion, ...over
  });
  const fetchFn = (async (u: string) => {
    const name = new URL(u).pathname.split('/').pop()!;
    hits.push(name);
    return name in files ? new Response(bytes(files[name])) : new Response('nope', { status: 404 });
  }) as unknown as typeof fetch;
  return { hits, entry, fetchFn };
}
const catalog = (packs: CatalogEntry[]): Catalog => ({ format: 1, generatedAt: '', packs });

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`upd-${n++}`); });
const ids = async () => (await listCollection(db, 'words')).map((r) => r.id).sort();

describe('planUpdates', () => {
  const e = (version: number, base?: number, size = 100, minAppVersion?: string): CatalogEntry =>
    ({ id: 'demo', version, base, url: `${base ?? 'full'}-${version}`, sha256: '', size, minAppVersion });

  it('chains small deltas to reach the newest version', async () => {
    await installPack(db, full(1, ['a']));
    const [plan] = await planUpdates(db, catalog([e(3, undefined, 1000), e(2, 1, 10), e(3, 2, 10)]));
    expect(plan.steps.map((s) => s.version)).toEqual([2, 3]);
    expect(plan).toMatchObject({ from: 1, to: 3, bytes: 20, fallback: e(3, undefined, 1000) });
  });
  it('prefers the full pack when the deltas are not smaller', async () => {
    await installPack(db, full(1, ['a']));
    const [plan] = await planUpdates(db, catalog([e(3, undefined, 50), e(2, 1, 40), e(3, 2, 40)]));
    expect(plan.steps).toEqual([e(3, undefined, 50)]);
  });
  it('uses the full pack when the delta chain is broken, and installs fresh from the full pack', async () => {
    await installPack(db, full(1, ['a']));
    const broken = catalog([e(4, undefined, 500), e(2, 1, 10), e(4, 3, 10)]);
    expect((await planUpdates(db, broken))[0].steps).toEqual([e(4, undefined, 500)]);
    const fresh = await openDatabase(`upd-fresh-${n++}`);
    expect((await planUpdates(fresh, broken))[0]).toMatchObject({ from: 0, steps: [e(4, undefined, 500)] });
  });
  it('plans nothing when up to date or ahead (no downgrades)', async () => {
    await installPack(db, full(2, ['a']));
    expect(await planUpdates(db, catalog([e(2, undefined), e(2, 1), e(1)]))).toEqual([]);
  });
  it('skips packs that need a newer app and says so', async () => {
    await installPack(db, full(1, ['a']));
    const cat = catalog([e(2, undefined, 100, '2.0.0')]);
    expect(await planUpdates(db, cat, '1.0.0')).toEqual([expect.objectContaining({ steps: [], needsNewerApp: '2.0.0' })]);
    expect((await planUpdates(db, cat, '2.0.0'))[0].steps).toHaveLength(1);
  });
});

describe('checkContentUpdates + applyUpdates', () => {
  it('downloads only the small delta, applies it, and leaves learner progress alone', async () => {
    await installPack(db, full(1, ['a', 'b']));
    await setUserData(db, 'srs.state:a', { due: 123 });
    const files = { 'demo-v2.pack.json': full(2, ['b', 'c', 'x'.repeat(2000)]), 'd.json': delta(1, 2, ['c'], ['a']) };
    const s = server(files);
    // The delta replaces `a` by `c` but keeps `b` => same result as installing v2 fully, with a tiny download.
    const cat = catalog([s.entry('demo-v2.pack.json', files['demo-v2.pack.json']), s.entry('d.json', files['d.json'])]);
    const catFetch = (async (u: string) => (u === URL_BASE ? new Response(JSON.stringify(cat)) : s.fetchFn(u))) as unknown as typeof fetch;

    const plans = await checkContentUpdates(db, URL_BASE, '0.1.0', catFetch);
    expect(plans[0].steps.map((x) => x.url)).toEqual(['d.json']);
    const results = await applyUpdates(db, plans, URL_BASE, { fetchFn: catFetch, appVersion: '0.1.0' });
    expect(results).toEqual([{ id: 'demo', ok: true, version: 2 }]);
    expect(s.hits).toEqual(['d.json']); // the big full pack was never downloaded
    expect(await ids()).toEqual(['b', 'c']);
    expect(await getUserData(db, 'srs.state:a')).toEqual({ due: 123 });
    expect(await checkContentUpdates(db, URL_BASE, '0.1.0', catFetch)).toEqual([]); // now up to date
  });

  it('rejects a download whose checksum does not match and keeps the old content', async () => {
    await installPack(db, full(1, ['a']));
    const files = { 'd.json': delta(1, 2, ['evil']) };
    const s = server(files);
    const wrong = s.entry('d.json', files['d.json'], { sha256: '0'.repeat(64) });
    const [res] = await applyUpdates(db, [{ id: 'demo', from: 1, to: 2, steps: [wrong], bytes: 1 }], URL_BASE, { fetchFn: s.fetchFn });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/mã kiểm tra/);
    expect(await ids()).toEqual(['a']);
  });

  it('falls back to the full pack when a delta cannot be applied', async () => {
    await installPack(db, full(1, ['a']));
    const files = { 'd.json': 'this is not json', 'f.json': full(2, ['a', 'z']) };
    const s = server(files);
    const plan = { id: 'demo', from: 1, to: 2, steps: [s.entry('d.json', delta(1, 2, []))], fallback: s.entry('f.json', full(2, [])), bytes: 1 };
    const [res] = await applyUpdates(db, [plan], URL_BASE, { fetchFn: s.fetchFn });
    expect(res).toEqual({ id: 'demo', ok: true, version: 2 });
    expect(await ids()).toEqual(['a', 'z']);
  });

  it('one failing pack does not stop the others', async () => {
    const other = (version: number): PackFile => ({ ...full(version, ['k']), manifest: { ...full(version, []).manifest, id: 'other' } });
    const files = { 'o.json': other(1) };
    const s = server(files);
    const bad: CatalogEntry = { id: 'demo', version: 2, url: 'missing.json', sha256: '', size: 1 };
    const results = await applyUpdates(db, [
      { id: 'demo', from: 0, to: 2, steps: [bad], bytes: 1 },
      { id: 'other', from: 0, to: 1, steps: [s.entry('o.json', other(1))], bytes: 1 }
    ], URL_BASE, { fetchFn: s.fetchFn });
    expect(results.map((r) => r.ok)).toEqual([false, true]);
  });

  it('refuses a pack that needs a newer app, and refuses plain http', async () => {
    const files = { 'f.json': full(1, ['a'], { minAppVersion: '9.0.0' }) };
    const s = server(files);
    const entry = s.entry('f.json', files['f.json']);
    const [res] = await applyUpdates(db, [{ id: 'demo', from: 0, to: 1, steps: [entry], bytes: 1 }], URL_BASE, { fetchFn: s.fetchFn, appVersion: '1.0.0' });
    expect(res.error).toMatch(/9\.0\.0/);
    const [http] = await applyUpdates(db, [{ id: 'demo', from: 0, to: 1, steps: [entry], bytes: 1 }], 'http://evil.example/catalog.json', { fetchFn: s.fetchFn });
    expect(http.error).toMatch(/https/);
    expect(await ids()).toEqual([]);
  });
});

describe('validateCatalog', () => {
  it('accepts a good catalog and rejects malformed ones', () => {
    const good = catalog([{ id: 'demo', version: 1, url: 'x', sha256: 'ab', size: 3 }]);
    expect(validateCatalog(good)).toBe(good);
    expect(() => validateCatalog({ format: 2, packs: [] })).toThrow();
    expect(() => validateCatalog({ format: 1, packs: [{ id: 'x' }] })).toThrow();
    expect(() => validateCatalog(catalog([{ id: 'demo', version: 1, url: 'x', sha256: 'ab', size: 3, minAppVersion: 'soon' }]))).toThrow();
  });
});
