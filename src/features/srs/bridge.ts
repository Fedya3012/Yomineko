// How other features hand words to the SRS. The SRS reads flashcards from the `cards` collection, which only
// packs may write (see docs/ARCHITECTURE.md). So everything the learner adds from the dictionary, manga or
// anime lives in ONE personal pack, `user-srs`. Card ids are stable, so adding twice never duplicates, and the
// review history (`srs.state:*`) is never touched.
import { getUserData, type DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import type { CardContent } from './types';

export const USER_PACK = 'user-srs';
/** userdata key where the anime player keeps cards made from subtitles (kept here to avoid an import cycle). */
const ANIME_CARDS_KEY = 'anime.cards';

export type CardSource = 'dictionary' | 'manga' | 'anime';
export interface UserCard extends CardContent { source: { kind: CardSource; origin?: string }; addedAt: number }

export interface AddWordInput {
  /** Dictionary entry id; makes the card id stable. */
  wordId: string;
  word: string; reading: string; meaning: string;
  /** Sentence the word was met in; becomes the fill-in-the-blank question when `blank` is inside it. */
  sentence?: string;
  /** The form of the word as written in `sentence` (may be conjugated). Defaults to `word`. */
  blank?: string;
  kind: CardSource;
  origin?: string;
}

export const cardIdFor = (kind: CardSource, wordId: string) => `${kind === 'anime' ? 'anime' : 'word'}:${wordId}`;

function toCard(i: AddWordInput, now: number): UserCard {
  const blank = [i.blank, i.word, i.reading].find((b) => b && i.sentence?.includes(b));
  return {
    id: cardIdFor(i.kind, i.wordId), word: i.word, reading: i.reading, meaning: i.meaning,
    ...(i.sentence && blank ? { example: { ja: i.sentence, blank } } : {}),
    source: { kind: i.kind, origin: i.origin }, addedAt: now
  };
}

// Installs are serialised: each one reads the pack, adds to it and bumps the version, so two at once would collide.
let queue: Promise<unknown> = Promise.resolve();

async function write(db: DB, adds: UserCard[]): Promise<number> {
  const existing = (await db.getAllFromIndex('records', 'byPack', USER_PACK)).map((r) => r.data as unknown as UserCard);
  const have = new Set(existing.map((c) => c.id));
  const fresh = adds.filter((c, i) => !have.has(c.id) && adds.findIndex((x) => x.id === c.id) === i);
  if (!fresh.length) return 0;
  const old = await db.get('packs', USER_PACK);
  await installPack(db, {
    manifest: {
      format: 1, id: USER_PACK, kind: 'deck', title: 'Thẻ tôi tự thêm', version: (old?.version ?? 0) + 1,
      license: { name: 'Nội dung của người học, chỉ dùng cá nhân', url: 'https://example.org/personal-use' }
    },
    upserts: { cards: [...existing, ...fresh] as unknown as { id: string }[] }
  });
  return fresh.length;
}
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
};

/** Adds one word as an SRS card. Returns false when the card already exists. */
export async function addWordToSrs(db: DB, input: AddWordInput, now = Date.now()): Promise<boolean> {
  return (await enqueue(() => write(db, [toCard(input, now)]))) > 0;
}

export async function hasSrsCard(db: DB, id: string): Promise<boolean> {
  return !!(await db.get('records', ['cards', id]));
}

/**
 * Copies cards the anime player made from subtitles (`anime.cards`, which the SRS never reads) into the SRS.
 * Safe to call any number of times. Returns how many cards were new.
 */
export async function syncAnimeCards(db: DB, now = Date.now()): Promise<number> {
  const made = (await getUserData<{ id: string; word: string; reading: string; meaning: string; sentence?: string; source?: string; createdAt?: number }[]>(db, ANIME_CARDS_KEY)) ?? [];
  if (!made.length) return 0;
  const adds = made.map((c): UserCard => ({
    id: c.id, word: c.word, reading: c.reading, meaning: c.meaning,
    ...(c.sentence && c.sentence.includes(c.word) ? { example: { ja: c.sentence, blank: c.word } } : {}),
    source: { kind: 'anime', origin: c.source }, addedAt: c.createdAt ?? now
  }));
  return enqueue(() => write(db, adds));
}
