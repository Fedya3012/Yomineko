// Downloads the real dictionary packs through the normal content-update feed (same catalog, checksums and
// all-or-nothing installs as the Update Center). Offline-first: nothing is needed after the first download.
import type { DB } from '../../lib/db';
import { CATALOG_URL, APP_VERSION } from '../../lib/appInfo';
import { applyUpdates, checkContentUpdates, type UpdateResult } from '../../lib/packs/updater';
import { uninstallPack } from '../../lib/packs/install';

export const DICT_PACK_IDS = ['jmdict-words', 'jmdict-examples', 'kanjidic'] as const;
export const SAMPLE_PACK_ID = 'dict-sample';

export interface DictionaryDownload { bytes: number; results: UpdateResult[] }

/** Size of what is still missing/outdated, or null when no dictionary pack is in the catalog. */
export async function planDictionaryDownload(db: DB, catalogUrl = CATALOG_URL, fetchFn: typeof fetch = fetch) {
  const plans = (await checkContentUpdates(db, catalogUrl, APP_VERSION, fetchFn)).filter((p) => (DICT_PACK_IDS as readonly string[]).includes(p.id) && p.steps.length);
  return { plans, bytes: plans.reduce((n, p) => n + p.bytes, 0) };
}

/** Download + install the dictionary packs. The 30-word sample is removed only after the real words are in. */
export async function downloadDictionary(
  db: DB, onProgress?: (text: string) => void, catalogUrl = CATALOG_URL, fetchFn: typeof fetch = fetch
): Promise<DictionaryDownload> {
  const { plans, bytes } = await planDictionaryDownload(db, catalogUrl, fetchFn);
  const results = await applyUpdates(db, plans, catalogUrl, {
    appVersion: APP_VERSION, fetchFn,
    onProgress: (done, count, plan) => onProgress?.(`Đang tải ${plan.id} (${Math.min(done + 1, count)}/${count})…`)
  });
  if (results.some((r) => r.id === 'jmdict-words' && r.ok)) await uninstallPack(db, SAMPLE_PACK_ID).catch(() => {});
  return { bytes, results };
}

export const hasRealDictionary = async (db: DB) => !!(await db.get('packs', 'jmdict-words'));
