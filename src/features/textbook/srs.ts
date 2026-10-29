// Bridge to the SRS (spaced repetition) feature.
//
// The SRS reads flashcards from the `cards` collection, which content packs fill. So adding a lesson
// to SRS installs a tiny personal pack `tb-srs-<lessonId>` holding that lesson's cards. Card ids are
// stable ("<lessonId>:word:<itemId>"), so adding twice updates the same cards and never duplicates,
// and removing the pack never touches the learner's review history (`srs.state:*`).
// Vocabulary and kanji become cards; grammar patterns do not (SRS cards are word + reading + meaning).
import type { DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import type { CardContent } from '../srs/types';
import { effectiveSource } from './logic';
import type { Lesson, Source } from './types';

/** A normal SRS card plus where it came from (extra fields are kept in the record and ignored by SRS). */
export interface TextbookCard extends CardContent {
  kind: 'word' | 'kanji';
  source: { textbookId: string; lessonId: string; origin: Source };
}

export const packId = (lessonId: string) => `tb-srs-${lessonId}`;

export function buildCards(l: Lesson): TextbookCard[] {
  const src = (item: { source?: Source }) => ({ textbookId: l.textbookId, lessonId: l.id, origin: effectiveSource(item, l) });
  return [
    ...(l.vocab ?? []).map((v): TextbookCard => ({ id: `${l.id}:word:${v.id}`, kind: 'word', word: v.word, reading: v.reading ?? v.word, meaning: v.meaning, source: src(v) })),
    ...(l.kanji ?? []).map((k): TextbookCard => ({ id: `${l.id}:kanji:${k.id}`, kind: 'kanji', word: k.char, reading: k.reading ?? k.char, meaning: k.meaning, source: src(k) }))
  ];
}

/** Returns how many cards the SRS now has for this lesson (0 when the lesson has nothing reviewable). */
export async function addLessonToSrs(db: DB, l: Lesson): Promise<number> {
  const cards = buildCards(l);
  if (!cards.length) return 0;
  const old = await db.get('packs', packId(l.id));
  await installPack(db, {
    manifest: {
      format: 1, id: packId(l.id), kind: 'deck', title: `Thẻ ôn: ${l.title}`, version: (old?.version ?? 0) + 1,
      license: { name: 'Nội dung của người học, chỉ dùng cá nhân', url: 'https://example.org/personal-use' }
    },
    upserts: { cards: cards as unknown as { id: string }[] }
  });
  return cards.length;
}

export async function srsCardCount(db: DB, lessonId: string): Promise<number> {
  return db.countFromIndex('records', 'byPack', packId(lessonId));
}
