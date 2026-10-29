// The learner's own copy of a textbook (PDF or EPUB), kept on the device in `userdata`.
// Never uploaded, never part of a content pack.
import type { DB } from '../../lib/db';
import type { Lesson, BookRef } from './types';

export type BookKind = 'pdf' | 'epub';
export interface BookFileMeta { name: string; kind: BookKind; size: number; addedAt: number }

const fileKey = (textbookId: string) => `textbook.file:${textbookId}`;
const metaKey = (textbookId: string) => `textbook.file.meta:${textbookId}`;
const refKey = (lessonId: string) => `textbook.bookref:${lessonId}`;

export function detectKind(name: string, type = ''): BookKind | undefined {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf') || type === 'application/pdf') return 'pdf';
  if (n.endsWith('.epub') || type === 'application/epub+zip') return 'epub';
  return undefined;
}

export async function saveBookFile(db: DB, textbookId: string, file: File, now = Date.now()): Promise<BookFileMeta> {
  const kind = detectKind(file.name, file.type);
  if (!kind) throw new Error('Chỉ mở được file PDF hoặc EPUB');
  const meta: BookFileMeta = { name: file.name, kind, size: file.size, addedAt: now };
  const tx = db.transaction('userdata', 'readwrite');
  tx.store.put(file, fileKey(textbookId));
  tx.store.put(meta, metaKey(textbookId));
  await tx.done;
  return meta;
}
export const loadBookMeta = (db: DB, textbookId: string) => db.get('userdata', metaKey(textbookId)) as Promise<BookFileMeta | undefined>;
export const loadBookFile = (db: DB, textbookId: string) => db.get('userdata', fileKey(textbookId)) as Promise<Blob | undefined>;
export async function removeBookFile(db: DB, textbookId: string) {
  const tx = db.transaction('userdata', 'readwrite');
  tx.store.delete(fileKey(textbookId));
  tx.store.delete(metaKey(textbookId));
  await tx.done;
}

/** Where a lesson starts in the file: the learner's own link wins over the one shipped in the pack. */
export const loadBookRef = async (db: DB, lesson: Lesson): Promise<BookRef | undefined> =>
  ((await db.get('userdata', refKey(lesson.id))) as BookRef | undefined) ?? lesson.bookRef;
export const saveBookRef = (db: DB, lessonId: string, ref: BookRef) => db.put('userdata', ref, refKey(lessonId));
export const clearBookRef = (db: DB, lessonId: string) => db.delete('userdata', refKey(lessonId));

/** Which lesson a page (PDF) or chapter (EPUB) belongs to: the last linked lesson starting at or before it. */
export function lessonAt(links: { lessonId: string; at: number }[], position: number): string | undefined {
  return [...links].sort((a, b) => a.at - b.at).filter((l) => l.at <= position).pop()?.lessonId;
}
