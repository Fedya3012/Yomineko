// The "check for new content, download only what changed, install it" flow used by the Update Center.
import type { DB } from '../db';
import { PackError, validateCatalog, type Catalog } from './format';
import { downloadAndInstall, planUpdates, type UpdatePlan } from './install';

export async function fetchCatalog(catalogUrl: string, fetchFn: typeof fetch = fetch): Promise<Catalog> {
  const res = await fetchFn(catalogUrl, { cache: 'no-cache' });
  if (!res.ok) throw new PackError(`Không lấy được danh mục gói (HTTP ${res.status})`);
  return validateCatalog(await res.json());
}

/** Ask the server what is new. Downloads nothing but the small catalog file. */
export async function checkContentUpdates(db: DB, catalogUrl: string, appVersion?: string, fetchFn: typeof fetch = fetch) {
  const catalog = await fetchCatalog(catalogUrl, fetchFn);
  return planUpdates(db, catalog, appVersion);
}

export interface UpdateResult { id: string; ok: boolean; version?: number; error?: string }

/**
 * Install the planned updates. Each pack is independent: if one fails, the others still update and the failed
 * one simply stays on its last good version (every step is all-or-nothing). If a delta step fails, the full
 * pack is tried once before giving up.
 */
export async function applyUpdates(
  db: DB, plans: UpdatePlan[], catalogUrl: string,
  opts: { appVersion?: string; fetchFn?: typeof fetch; onProgress?: (done: number, total: number, plan: UpdatePlan) => void } = {}
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  const todo = plans.filter((p) => p.steps.length > 0);
  let done = 0;
  for (const plan of todo) {
    opts.onProgress?.(done, todo.length, plan);
    const run = (e: UpdatePlan['steps'][number]) => downloadAndInstall(db, e, catalogUrl, opts.fetchFn, opts.appVersion);
    try {
      let version = plan.from;
      try {
        for (const step of plan.steps) version = (await run(step)).version;
      } catch (err) {
        if (!plan.fallback || version >= plan.to) throw err;
        version = (await run(plan.fallback)).version; // delta path broke: use the full pack
      }
      results.push({ id: plan.id, ok: true, version });
    } catch (err) {
      results.push({ id: plan.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    opts.onProgress?.(++done, todo.length, plan);
  }
  return results;
}
