// Bridge to the SRS (spaced repetition) thread.
//
// The SRS feature does not exist yet, so lessons hand over *ready-made cards* through a small
// inbox in `userdata`: key `srs.inbox:<lessonId>` -> SrsInbox. The SRS thread should read every
// `srs.inbox:*` entry, create its own cards (collection `cards`, state `srs.state:<cardId>`),
// and may delete the inbox entry afterwards. Card ids are stable, so adding twice never duplicates.
import type { DB } from '../../lib/db';
import { effectiveSource } from './logic';
import type { Lesson, Source } from './types';

export interface SrsCard {
  id: string;                          // stable: "<lessonId>:<kind>:<itemId>"
  kind: 'word' | 'kanji' | 'grammar';
  front: string;
  back: string;
  reading?: string;
  source: { textbookId: string; lessonId: string; origin: Source };
}
export interface SrsInbox { lessonId: string; addedAt: number; cards: SrsCard[] }

export const inboxKey = (lessonId: string) => `srs.inbox:${lessonId}`;

export function buildCards(l: Lesson): SrsCard[] {
  const src = (item: { source?: Source }) => ({ textbookId: l.textbookId, lessonId: l.id, origin: effectiveSource(item, l) });
  return [
    ...(l.vocab ?? []).map((v): SrsCard => ({ id: `${l.id}:word:${v.id}`, kind: 'word', front: v.word, back: v.meaning, reading: v.reading, source: src(v) })),
    ...(l.kanji ?? []).map((k): SrsCard => ({ id: `${l.id}:kanji:${k.id}`, kind: 'kanji', front: k.char, back: k.meaning, reading: k.reading, source: src(k) })),
    ...(l.grammar ?? []).map((g): SrsCard => ({ id: `${l.id}:grammar:${g.id}`, kind: 'grammar', front: g.pattern, back: g.title, source: src(g) }))
  ];
}

/** Returns how many cards are waiting for the SRS (0 when the lesson has nothing reviewable). */
export async function addLessonToSrs(db: DB, l: Lesson, now = Date.now()): Promise<number> {
  const cards = buildCards(l);
  if (!cards.length) return 0;
  await db.put('userdata', { lessonId: l.id, addedAt: now, cards } satisfies SrsInbox, inboxKey(l.id));
  return cards.length;
}

export async function srsCardCount(db: DB, lessonId: string): Promise<number> {
  return ((await db.get('userdata', inboxKey(lessonId))) as SrsInbox | undefined)?.cards.length ?? 0;
}
