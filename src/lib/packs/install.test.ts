import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, listCollection, getUserData, setUserData, type DB } from '../db';
import { installPack, planUpdates, uninstallPack } from './install';
import type { PackFile } from './format';

const license = { name: 'CC BY-SA 4.0', url: 'https://example.org/license' };
const full = (version: number, ids: string[]): PackFile => ({
  manifest: { format: 1, id: 'demo', kind: 'deck', title: 'Demo', version, license },
  upserts: { words: ids.map((id) => ({ id, text: id })) }
});

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`test-${n++}`); });

describe('installPack', () => {
  it('installs a full pack and replaces older content on re-install', async () => {
    await installPack(db, full(1, ['a', 'b']));
    await installPack(db, full(2, ['b', 'c']));
    const ids = (await listCollection(db, 'words')).map((r) => r.id).sort();
    expect(ids).toEqual(['b', 'c']);
  });

  it('applies a delta only on the right base version', async () => {
    await installPack(db, full(1, ['a', 'b']));
    const delta: PackFile = {
      manifest: { ...full(2, []).manifest, base: 1 },
      upserts: { words: [{ id: 'c', text: 'c' }] }, deletes: { words: ['a'] }
    };
    await installPack(db, delta);
    expect((await listCollection(db, 'words')).map((r) => r.id).sort()).toEqual(['b', 'c']);
    await expect(installPack(db, { ...delta, manifest: { ...delta.manifest, version: 3, base: 1 } })).rejects.toThrow();
  });

  it('rejects invalid packs and never touches learner data', async () => {
    await setUserData(db, 'progress', { streak: 7 });
    await expect(installPack(db, { manifest: { id: 'x' } })).rejects.toThrow();
    await installPack(db, full(1, ['a']));
    await uninstallPack(db, 'demo');
    expect(await listCollection(db, 'words')).toEqual([]);
    expect(await getUserData(db, 'progress')).toEqual({ streak: 7 });
  });

  it('refuses downgrades', async () => {
    await installPack(db, full(2, ['a']));
    await expect(installPack(db, full(1, ['z']))).rejects.toThrow();
  });
});

describe('planUpdates', () => {
  it('prefers a matching delta, otherwise the newest full pack', async () => {
    await installPack(db, full(1, ['a']));
    const e = (version: number, base?: number) => ({ id: 'demo', version, url: `v${version}.json`, sha256: '', size: 1, base });
    const plan = await planUpdates(db, { format: 1, generatedAt: '', packs: [e(2, 1), e(3), e(3, 2)] });
    expect(plan).toEqual([e(2, 1)]); // delta first; the next check then picks up v3
  });
});
