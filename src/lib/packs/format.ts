// Content pack format v1.
//
// A "pack" is one JSON file holding learning content (a dictionary slice, a kanji set,
// a lesson, a deck...). Packs are how Yomineko gets new content WITHOUT a new app release.
//
//  - "full" pack  : replaces everything the pack owned before.
//  - "delta" pack : `base` = version it upgrades from; carries only changed/removed records.
//
// A "catalog" is a small index.json listing the packs available to download.
// No copyrighted manga/anime/textbook content is ever shipped: packs hold only open data
// (JMdict, KANJIDIC, ...) or things the user creates/imports themselves.

export const PACK_FORMAT = 1;

export type PackKind = 'dictionary' | 'kanji' | 'kana' | 'deck' | 'lesson' | 'subtitle' | 'other';

export interface License {
  name: string;            // e.g. "CC BY-SA 4.0"
  url: string;
  attribution?: string;    // text we must show in the Credits screen
}

export interface PackManifest {
  format: typeof PACK_FORMAT;
  id: string;              // stable id, e.g. "jmdict-core"
  kind: PackKind;
  title: string;
  version: number;         // integer, strictly increasing
  base?: number;           // present => delta pack, upgrades from this version
  minAppVersion?: string;  // semver, optional
  license: License;
}

export type RecordData = { id: string } & Record<string, unknown>;

export interface PackFile {
  manifest: PackManifest;
  /** collection name -> records to add/replace. Collections are owned by feature threads (e.g. "words", "kanji", "cards"). */
  upserts?: Record<string, RecordData[]>;
  /** collection name -> ids to remove (delta packs only). */
  deletes?: Record<string, string[]>;
}

export interface CatalogEntry {
  id: string;
  version: number;
  url: string;             // absolute, or relative to the catalog URL
  sha256: string;          // hex digest of the pack file bytes
  size: number;            // bytes, for showing download size
  base?: number;           // for delta entries
}

export interface Catalog {
  format: typeof PACK_FORMAT;
  generatedAt: string;
  packs: CatalogEntry[];
}

export class PackError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Throws PackError with a human-readable reason if `x` is not a valid pack. */
export function validatePack(x: unknown): PackFile {
  if (!isObj(x) || !isObj(x.manifest)) throw new PackError('Thiếu phần manifest');
  const m = x.manifest;
  if (m.format !== PACK_FORMAT) throw new PackError(`Định dạng gói ${String(m.format)} chưa được hỗ trợ`);
  if (typeof m.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(m.id)) throw new PackError('id gói không hợp lệ');
  if (typeof m.title !== 'string') throw new PackError('Thiếu tiêu đề gói');
  if (!Number.isInteger(m.version) || (m.version as number) < 1) throw new PackError('version phải là số nguyên ≥ 1');
  if (m.base !== undefined && (!Number.isInteger(m.base) || (m.base as number) >= (m.version as number)))
    throw new PackError('base phải nhỏ hơn version');
  if (!isObj(m.license) || typeof m.license.name !== 'string' || typeof m.license.url !== 'string')
    throw new PackError('Gói phải ghi rõ giấy phép (license)');
  for (const [field, kind] of [['upserts', 'array'], ['deletes', 'array']] as const) {
    const part = x[field];
    if (part === undefined) continue;
    if (!isObj(part)) throw new PackError(`${field} phải là object`);
    for (const [col, list] of Object.entries(part)) {
      if (!Array.isArray(list)) throw new PackError(`${field}.${col} phải là ${kind}`);
      if (field === 'upserts' && !list.every((r) => isObj(r) && typeof r.id === 'string'))
        throw new PackError(`Mỗi bản ghi trong ${col} cần có id dạng chữ`);
    }
  }
  if (x.deletes && m.base === undefined) throw new PackError('Gói đầy đủ không được có deletes');
  return x as unknown as PackFile;
}
