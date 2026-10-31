// Reads/writes SRS data. Learner progress goes ONLY to the `userdata` store (see docs/ARCHITECTURE.md),
// so installing or removing content packs can never erase it.
import { getUserData, listCollection, setUserData, type DB } from '../../lib/db';
import { getKnown, KANA_KNOWN_KEY, KNOWN_KEY } from '../kana-kanji/model';
import { DEFAULT_SETTINGS, emptyStats, type CardContent, type CardState, type DayStats, type LearnedSet, type SrsSettings } from './types';

const STATE_PREFIX = 'srs.state:';
export const stateKey = (cardId: string) => STATE_PREFIX + cardId;
export const statsKey = (day: string) => `srs.stats:${day}`;
export const SETTINGS_KEY = 'srs.settings';

/** Local calendar day, e.g. "2026-10-29" (the "new cards per day" limit resets at local midnight). */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const loadCards = (db: DB) => listCollection(db, 'cards') as unknown as Promise<CardContent[]>;

export async function loadStates(db: DB): Promise<Map<string, CardState>> {
  const rows = (await db.getAll('userdata', IDBKeyRange.bound(STATE_PREFIX, STATE_PREFIX + '￿'))) as CardState[];
  return new Map(rows.map((s) => [s.cardId, s]));
}

export const saveState = (db: DB, state: CardState) => setUserData(db, stateKey(state.cardId), state);
export const deleteState = (db: DB, cardId: string) => db.delete('userdata', stateKey(cardId));

export async function loadSettings(db: DB): Promise<SrsSettings> {
  return { ...DEFAULT_SETTINGS, ...(await getUserData<Partial<SrsSettings>>(db, SETTINGS_KEY)) };
}
export const saveSettings = (db: DB, s: SrsSettings) => setUserData(db, SETTINGS_KEY, s);

export async function loadStats(db: DB, day: string): Promise<DayStats> {
  return { ...emptyStats(), ...(await getUserData<Partial<DayStats>>(db, statsKey(day))) };
}
export const saveStats = (db: DB, day: string, s: DayStats) => setUserData(db, statsKey(day), s);

/** Which kana and kanji the learner has marked as learned; the review only asks about those. */
export async function loadLearned(db: DB): Promise<LearnedSet> {
  const [kana, kanji] = await Promise.all([getKnown(db, KANA_KNOWN_KEY), getKnown(db, KNOWN_KEY)]);
  return { kana, kanji };
}
