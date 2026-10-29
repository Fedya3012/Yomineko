import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, type DB } from '../../lib/db';
import { clearBookRef, detectKind, lessonAt, loadBookFile, loadBookMeta, loadBookRef, removeBookFile, saveBookFile, saveBookRef } from './bookfile';
import type { Lesson } from './types';

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`bookfile-test-${n++}`); });
const lesson: Lesson = { id: 'b-l01', textbookId: 'b', order: 1, title: 'Bài 1', bookRef: { page: 10 } };

describe('book files', () => {
  it('detects PDF and EPUB by name or type, and nothing else', () => {
    expect(detectKind('Genki.PDF')).toBe('pdf');
    expect(detectKind('x', 'application/epub+zip')).toBe('epub');
    expect(detectKind('notes.docx')).toBeUndefined();
  });
  it('stores the learner\'s file per book, and removes it', async () => {
    const meta = await saveBookFile(db, 'b', new File(['%PDF'], 'sach.pdf', { type: 'application/pdf' }), 5);
    expect(meta).toEqual({ name: 'sach.pdf', kind: 'pdf', size: 4, addedAt: 5 });
    expect(await loadBookFile(db, 'b')).toBeTruthy();
    expect(await loadBookMeta(db, 'other')).toBeUndefined();
    await removeBookFile(db, 'b');
    expect(await loadBookFile(db, 'b')).toBeUndefined();
    expect(await loadBookMeta(db, 'b')).toBeUndefined();
  });
  it('refuses other file types', async () => {
    await expect(saveBookFile(db, 'b', new File(['x'], 'a.docx'))).rejects.toThrow();
    expect(await loadBookMeta(db, 'b')).toBeUndefined();
  });
});

describe('lesson to page links', () => {
  it('the learner\'s own link wins over the pack\'s, and can be cleared', async () => {
    expect(await loadBookRef(db, lesson)).toEqual({ page: 10 });
    await saveBookRef(db, lesson.id, { page: 12 });
    expect(await loadBookRef(db, lesson)).toEqual({ page: 12 });
    await clearBookRef(db, lesson.id);
    expect(await loadBookRef(db, lesson)).toEqual({ page: 10 });
  });
  it('finds which lesson a page belongs to', () => {
    const links = [{ lessonId: 'l2', at: 30 }, { lessonId: 'l1', at: 10 }];
    expect(lessonAt(links, 5)).toBeUndefined();
    expect(lessonAt(links, 10)).toBe('l1');
    expect(lessonAt(links, 29)).toBe('l1');
    expect(lessonAt(links, 99)).toBe('l2');
  });
});
