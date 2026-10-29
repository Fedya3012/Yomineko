import { getUserData, setUserData, type DB } from '../../lib/db';
import type { Direction, ViewMode } from './spreads';

// Learner data lives in the `userdata` store (never in content packs), see docs/ARCHITECTURE.md.
export interface ReaderPosition { page: number; savedAt: number }
export interface ReaderPrefs { direction: Direction; mode: ViewMode; coverAlone: boolean }

export const DEFAULT_PREFS: ReaderPrefs = { direction: 'rtl', mode: 'single', coverAlone: true };

export async function loadPosition(db: DB, bookId: string, pageCount: number): Promise<number> {
  const saved = await getUserData<ReaderPosition>(db, `reader.position:${bookId}`);
  const page = saved?.page ?? 0;
  return Math.min(Math.max(0, Math.trunc(page)), Math.max(0, pageCount - 1));
}

export const savePosition = (db: DB, bookId: string, page: number, now = Date.now()) =>
  setUserData(db, `reader.position:${bookId}`, { page, savedAt: now } satisfies ReaderPosition);

export async function loadPrefs(db: DB): Promise<ReaderPrefs> {
  return { ...DEFAULT_PREFS, ...(await getUserData<Partial<ReaderPrefs>>(db, 'reader.prefs')) };
}
export const savePrefs = (db: DB, prefs: ReaderPrefs) => setUserData(db, 'reader.prefs', prefs);
