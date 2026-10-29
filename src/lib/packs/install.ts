import { PackError, validatePack, type Catalog, type CatalogEntry, type PackFile } from './format';
import type { DB } from '../db';

/**
 * Apply a pack to the database in ONE transaction: either everything lands or nothing does.
 *  - full pack  : wipes records previously owned by this pack, then inserts.
 *  - delta pack : only allowed if installed version === manifest.base.
 */
export async function installPack(db: DB, input: unknown): Promise<{ id: string; version: number }> {
  const pack: PackFile = validatePack(input);
  const { manifest } = pack;
  const tx = db.transaction(['packs', 'records'], 'readwrite');
  const current = await tx.objectStore('packs').get(manifest.id);
  const reject = (msg: string): never => {
    tx.done.catch(() => {}); // aborting makes tx.done reject; we report our own error instead
    tx.abort();
    throw new PackError(msg);
  };

  if (current && manifest.version <= current.version) {
    reject(`Gói ${manifest.id} đã ở phiên bản ${current.version}, không cần cài ${manifest.version}`);
  }
  if (manifest.base !== undefined && current?.version !== manifest.base) {
    reject(`Gói cập nhật cần bản ${manifest.base} nhưng máy đang có ${current?.version ?? 'chưa cài'}`);
  }

  const records = tx.objectStore('records');
  if (manifest.base === undefined) {
    for (const key of await records.index('byPack').getAllKeys(manifest.id)) await records.delete(key);
  }
  for (const [collection, ids] of Object.entries(pack.deletes ?? {}))
    for (const id of ids) await records.delete([collection, id]);
  for (const [collection, rows] of Object.entries(pack.upserts ?? {}))
    for (const data of rows) await records.put({ collection, id: data.id, packId: manifest.id, data });

  await tx.objectStore('packs').put({
    id: manifest.id, kind: manifest.kind, title: manifest.title, version: manifest.version,
    license: manifest.license, installedAt: Date.now()
  });
  await tx.done;
  return { id: manifest.id, version: manifest.version };
}

/** Remove a pack and everything it owns. Learner data is untouched. */
export async function uninstallPack(db: DB, packId: string): Promise<void> {
  const tx = db.transaction(['packs', 'records'], 'readwrite');
  const records = tx.objectStore('records');
  for (const key of await records.index('byPack').getAllKeys(packId)) await records.delete(key);
  await tx.objectStore('packs').delete(packId);
  await tx.done;
}

/** Which catalog entries are worth downloading? Prefers a delta that matches what is installed, else the newest full pack. */
export async function planUpdates(db: DB, catalog: Catalog): Promise<CatalogEntry[]> {
  const installed = new Map((await db.getAll('packs')).map((p) => [p.id, p.version]));
  const byPack = new Map<string, CatalogEntry[]>();
  for (const e of catalog.packs) byPack.set(e.id, [...(byPack.get(e.id) ?? []), e]);

  const plan: CatalogEntry[] = [];
  for (const [id, entries] of byPack) {
    const have = installed.get(id) ?? 0;
    const newer = entries.filter((e) => e.version > have).sort((a, b) => b.version - a.version);
    const best = newer.find((e) => e.base === have && have > 0) ?? newer.find((e) => e.base === undefined);
    if (best) plan.push(best);
  }
  return plan;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Download one catalog entry, verify its checksum, install it. */
export async function downloadAndInstall(db: DB, entry: CatalogEntry, catalogUrl: string, fetchFn: typeof fetch = fetch) {
  const res = await fetchFn(new URL(entry.url, catalogUrl).toString());
  if (!res.ok) throw new PackError(`Tải gói thất bại (HTTP ${res.status})`);
  const bytes = await res.arrayBuffer();
  if ((await sha256Hex(bytes)) !== entry.sha256) throw new PackError('Gói tải về bị hỏng (sai mã kiểm tra)');
  return installPack(db, JSON.parse(new TextDecoder().decode(bytes)));
}
