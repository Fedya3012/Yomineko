// Turns the packs in `packs-src/` into what gets published: full packs, delta packs, and catalog.json.
//
//   packs-src/<id>/v1.json, v2.json, ...   <- you add one new full file per release (see the guide)
//   <out>/<id>-v3.pack.json                <- full pack of the newest version
//   <out>/<id>-v2-to-v3.delta.json         <- only what changed between consecutive versions
//   <out>/catalog.json                     <- list of everything, with SHA-256 checksums
//
// (The command-line wrapper is scripts/packs-build.ts; tests import this file.)
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACK_FORMAT, PackError, validatePack, type Catalog, type CatalogEntry, type PackFile, type RecordData } from '../src/lib/packs/format';

// JSON with sorted keys, so two records compare equal no matter how their fields were ordered.
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1)))
      : val);

/** The smallest pack that turns `old` into `next`: changed/new records and removed ids. */
export function makeDelta(old: PackFile, next: PackFile): PackFile {
  const upserts: Record<string, RecordData[]> = {};
  const deletes: Record<string, string[]> = {};
  const collections = new Set([...Object.keys(old.upserts ?? {}), ...Object.keys(next.upserts ?? {})]);
  for (const col of collections) {
    const before = new Map((old.upserts?.[col] ?? []).map((r) => [r.id, canon(r)]));
    const after = next.upserts?.[col] ?? [];
    const changed = after.filter((r) => before.get(r.id) !== canon(r));
    const kept = new Set(after.map((r) => r.id));
    const gone = [...before.keys()].filter((id) => !kept.has(id));
    if (changed.length) upserts[col] = changed;
    if (gone.length) deletes[col] = gone;
  }
  const delta: PackFile = { manifest: { ...next.manifest, base: old.manifest.version } };
  if (Object.keys(upserts).length) delta.upserts = upserts;
  if (Object.keys(deletes).length) delta.deletes = deletes;
  return delta;
}

const write = (path: string, data: unknown): CatalogEntry => {
  const bytes = Buffer.from(JSON.stringify(data));
  writeFileSync(path, bytes);
  return { id: '', version: 0, url: '', sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
};

export function loadVersions(packDir: string, id: string): PackFile[] {
  const files = readdirSync(packDir).filter((f) => /^v\d+\.json$/.test(f));
  if (files.length === 0) throw new PackError(`${id}: thư mục chưa có file v1.json`);
  const packs = files.map((f) => {
    let pack: PackFile;
    try { pack = validatePack(JSON.parse(readFileSync(join(packDir, f), 'utf8'))); }
    catch (e) { throw new PackError(`${id}/${f}: ${e instanceof Error ? e.message : e}`); }
    const n = Number(f.slice(1, -5));
    if (pack.manifest.id !== id) throw new PackError(`${id}/${f}: "id" trong file là "${pack.manifest.id}", phải trùng tên thư mục "${id}"`);
    if (pack.manifest.version !== n) throw new PackError(`${id}/${f}: "version" trong file là ${pack.manifest.version}, phải là ${n} cho khớp tên file`);
    if (pack.manifest.base !== undefined || pack.deletes) throw new PackError(`${id}/${f}: file nguồn phải là gói ĐẦY ĐỦ (không có "base"/"deletes"); gói cập nhật được tạo tự động`);
    return pack;
  });
  packs.sort((a, b) => a.manifest.version - b.manifest.version);
  return packs;
}

export function buildPacks(srcDir: string, outDir: string): Catalog {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const entries: CatalogEntry[] = [];
  const ids = readdirSync(srcDir).filter((d) => statSync(join(srcDir, d)).isDirectory()).sort();
  for (const id of ids) {
    const versions = loadVersions(join(srcDir, id), id);
    const latest = versions[versions.length - 1];
    const meta = (p: PackFile) => ({ id, version: p.manifest.version, minAppVersion: p.manifest.minAppVersion });
    const full = `${id}-v${latest.manifest.version}.pack.json`;
    entries.push({ ...write(join(outDir, full), latest), ...meta(latest), url: full });
    for (let i = 1; i < versions.length; i++) {
      const name = `${id}-v${versions[i - 1].manifest.version}-to-v${versions[i].manifest.version}.delta.json`;
      entries.push({ ...write(join(outDir, name), makeDelta(versions[i - 1], versions[i])), ...meta(versions[i]), base: versions[i - 1].manifest.version, url: name });
    }
  }
  const catalog: Catalog = { format: PACK_FORMAT, generatedAt: new Date().toISOString(), packs: entries };
  writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
  return catalog;
}
