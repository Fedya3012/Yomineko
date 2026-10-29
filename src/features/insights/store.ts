import { getUserData, setUserData, type DB } from '../../lib/db';
import { dateKey } from '../progress/stats';
import { loadLogs } from '../progress/store';
import { statsKey } from '../srs/store';
import { emptyStats, type DayStats } from '../srs/types';
import { analyzeWeakness, reviewBoost } from './weakness';

const KEY = 'insights.settings';
/** `insights.settings`. Adaptive difficulty only changes SRS settings on its own when the learner switches it on. */
export interface InsightsSettings { adaptiveAuto: boolean; lastAuto?: string }
export const DEFAULT_INSIGHTS: InsightsSettings = { adaptiveAuto: false };

export async function loadInsightsSettings(db: DB): Promise<InsightsSettings> {
  return { ...DEFAULT_INSIGHTS, ...(await getUserData<Partial<InsightsSettings>>(db, KEY)) };
}
export const saveInsightsSettings = (db: DB, s: InsightsSettings) => setUserData(db, KEY, s);

const PREFIX = 'srs.stats:';
export async function loadSrsStats(db: DB): Promise<Map<string, DayStats>> {
  const range = IDBKeyRange.bound(PREFIX, PREFIX + '￿');
  const [keys, values] = await Promise.all([db.getAllKeys('userdata', range), db.getAll('userdata', range)]);
  return new Map(keys.map((k, i) => [String(k).slice(PREFIX.length), { ...emptyStats(), ...(values[i] as Partial<DayStats>) }]));
}
export { statsKey };

/** cardId -> weakness score, used by the SRS queue so repeated mistakes come back sooner. */
export async function loadBoost(db: DB, now = Date.now()): Promise<Map<string, number>> {
  return reviewBoost(analyzeWeakness(await loadLogs(db), dateKey(new Date(now))));
}
