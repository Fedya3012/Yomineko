import { PackError, validatePack, type Catalog, type CatalogEntry, type PackFile } from './format';
import type { DB } from '../db';
import { compareVersions } from '../version';

/**
 * Apply a pack to the database in ONE transaction: either everything lands or nothing does.
 *  - full pack  : wipes records previously owned by this pack, then inserts.
 *  - delta pack : only allowed if installed version === manifest.base.
 * Only the `packs` and `records` stores are touched, never `userdata`: learner progress survives every update.
 * `appVersion` (optional) makes the install refuse packs that need a newer app.
 */
export async function installPack(db: DB, input: unknown, appVersion?: string): Promise<{ id: string; version: number }> {
  const pack: PackFile = validatePack(input);
  const { manifest } = pack;
  if (appVersion && manifest.minAppVersion && compareVersions(appVersion, manifest.minAppVersion) < 0)
    throw new PackError(`Gói ${manifest.id} cần app phiên bản ${manifest.minAppVersion} trở lên (đang là ${appVersion}). Hãy cập nhật app trước.`);
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

/** What to download for one pack: a chain of small deltas, or one full pack. */
export interface UpdatePlan {
  id: string;
  from: number;            // installed version (0 = not installed yet)
  to: number;
  steps: CatalogEntry[];   // applied in order; each step is its own all-or-nothing install
  fallback?: CatalogEntry; // full pack of version `to`, used if a delta step fails
  bytes: number;           // total download size of `steps`
  needsNewerApp?: string;  // set instead of steps when only newer packs exist that this app cannot read
}

const sum = (list: CatalogEntry[]) => list.reduce((n, e) => n + e.size, 0);

/**
 * Decide, per installed (or new) pack, the cheapest safe way to reach the newest version this app can read:
 *  - follow delta packs that start exactly at the installed version, as long as they are smaller than the full pack;
 *  - otherwise download the newest full pack.
 * Never downgrades. Entries needing a newer app (`minAppVersion`) are skipped.
 */
export async function planUpdates(db: DB, catalog: Catalog, appVersion?: string): Promise<UpdatePlan[]> {
  const installed = new Map((await db.getAll('packs')).map((p) => [p.id, p.version]));
  const byPack = new Map<string, CatalogEntry[]>();
  for (const e of catalog.packs) byPack.set(e.id, [...(byPack.get(e.id) ?? []), e]);
  const readable = (e: CatalogEntry) => !appVersion || !e.minAppVersion || compareVersions(appVersion, e.minAppVersion) >= 0;

  const plans: UpdatePlan[] = [];
  for (const [id, all] of byPack) {
    const have = installed.get(id) ?? 0;
    const newest = Math.max(...all.map((e) => e.version));
    const entries = all.filter((e) => e.version > have && readable(e));
    if (entries.length === 0) {
      const blocked = all.find((e) => e.version > have && e.version === newest && !readable(e));
      if (blocked && have > 0) plans.push({ id, from: have, to: newest, steps: [], bytes: 0, needsNewerApp: blocked.minAppVersion });
      continue;
    }
    const to = Math.max(...entries.map((e) => e.version));
    const full = entries.filter((e) => e.base === undefined && e.version === to).sort((a, b) => a.size - b.size)[0];

    let chain: CatalogEntry[] = [];
    if (have > 0) {
      let at = have;
      while (at < to) {
        const next = entries.filter((e) => e.base === at && e.version <= to).sort((a, b) => b.version - a.version)[0];
        if (!next) break;
        chain.push(next);
        at = next.version;
      }
      if (at !== to) chain = [];
    }
    const useChain = chain.length > 0 && (!full || sum(chain) < full.size);
    const steps = useChain ? chain : full ? [full] : [];
    if (steps.length === 0) continue; // e.g. only a broken delta chain exists: wait for a full pack
    plans.push({ id, from: have, to, steps, fallback: useChain ? full : undefined, bytes: sum(steps) });
  }
  return plans;
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Resolve a catalog entry's url; only https (or localhost for testing) is accepted. */
function entryUrl(entry: CatalogEntry, catalogUrl: string): string {
  const url = new URL(entry.url, catalogUrl);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new PackError('Gói phải được tải qua https');
  return url.toString();
}

/** Download one catalog entry, verify its checksum, install it. The pack never touches the database if the checksum is wrong. */
export async function downloadAndInstall(
  db: DB, entry: CatalogEntry, catalogUrl: string, fetchFn: typeof fetch = fetch, appVersion?: string
) {
  const res = await fetchFn(entryUrl(entry, catalogUrl), { cache: 'no-cache' });
  if (!res.ok) throw new PackError(`Tải gói thất bại (HTTP ${res.status})`);
  const bytes = await res.arrayBuffer();
  if ((await sha256Hex(bytes)) !== entry.sha256) throw new PackError('Gói tải về bị hỏng (sai mã kiểm tra)');
  return installPack(db, JSON.parse(new TextDecoder().decode(bytes)), appVersion);
}
