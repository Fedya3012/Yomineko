// Installing, updating and removing the optional Jitendex pack. It lives in its own catalog (see JITENDEX_CATALOG_URL),
// so the normal "check for updates" never downloads it unasked; the learner opts in from the Dictionary screen.
import type { DB } from '../../lib/db';
import { JITENDEX_CATALOG_URL, APP_VERSION } from '../../lib/appInfo';
import { fetchCatalog, applyUpdates } from '../../lib/packs/updater';
import { planUpdates, uninstallPack, type UpdatePlan } from '../../lib/packs/install';
import { JITENDEX_PACK_ID } from './jitendex';

export interface JitendexStatus {
  installed?: number;     // installed version
  available?: number;     // newest version in the catalog
  plan?: UpdatePlan;      // what installing/updating would download
}

/** Ask the Jitendex catalog what is on offer. Downloads only the small catalog file. */
export async function checkJitendex(
  db: DB, catalogUrl = JITENDEX_CATALOG_URL, appVersion = APP_VERSION, fetchFn: typeof fetch = fetch
): Promise<JitendexStatus> {
  const installed = (await db.get('packs', JITENDEX_PACK_ID))?.version;
  const catalog = await fetchCatalog(catalogUrl, fetchFn);
  const plan = (await planUpdates(db, { ...catalog, packs: catalog.packs.filter((e) => e.id === JITENDEX_PACK_ID) }, appVersion))
    .find((p) => p.id === JITENDEX_PACK_ID && p.steps.length > 0);
  const newest = Math.max(0, ...catalog.packs.filter((e) => e.id === JITENDEX_PACK_ID).map((e) => e.version));
  return { installed, available: newest || undefined, plan };
}

/** Download and install the planned pack. Throws with a readable reason; an old copy stays if the new one fails. */
export async function installJitendex(
  db: DB, plan: UpdatePlan, catalogUrl = JITENDEX_CATALOG_URL, appVersion = APP_VERSION, fetchFn: typeof fetch = fetch
): Promise<void> {
  const [result] = await applyUpdates(db, [plan], catalogUrl, { appVersion, fetchFn });
  if (!result?.ok) throw new Error(result?.error ?? 'Cài Jitendex chưa xong');
}

export const removeJitendex = (db: DB) => uninstallPack(db, JITENDEX_PACK_ID);
