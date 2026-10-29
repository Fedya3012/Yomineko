import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../lib/db';
import { DEFAULT_PREFS, loadPosition, loadPrefs, savePosition, savePrefs } from './position';

describe('reader position and prefs', () => {
  it('remembers the page per book and clamps it to the book length', async () => {
    const db = await openDatabase('test-reader-position');
    expect(await loadPosition(db, 'book-a', 50)).toBe(0);
    await savePosition(db, 'book-a', 42);
    expect(await loadPosition(db, 'book-a', 50)).toBe(42);
    expect(await loadPosition(db, 'book-a', 10)).toBe(9); // book got shorter
    expect(await loadPosition(db, 'book-b', 50)).toBe(0);
  });

  it('stores display preferences with defaults', async () => {
    const db = await openDatabase('test-reader-prefs');
    expect(await loadPrefs(db)).toEqual(DEFAULT_PREFS);
    await savePrefs(db, { direction: 'ltr', mode: 'double', coverAlone: false });
    expect(await loadPrefs(db)).toEqual({ direction: 'ltr', mode: 'double', coverAlone: false });
  });
});
