// Learner data for the anime feature. Lives in the `userdata` store, so updating content packs never touches it.
//   anime.known   : string[]  keys of words the learner knows (see Token.key)
//   anime.cards   : NewCard[] cards auto-created from subtitles; the SRS thread picks these up for review
import { getUserData, setUserData, type DB } from '../../lib/db';
import type { Cue } from './subtitles';
import type { DictIndex, Token } from './tokenizer';

export interface NewCard {
  id: string;            // "anime:<word key>"
  word: string;          // dictionary form shown on the card front
  reading: string;
  meaning: string;
  sentence: string;      // the subtitle line the word was met in (context beats isolated words)
  source: string;        // subtitle file name
  createdAt: number;
}

export const KNOWN_KEY = 'anime.known';
export const CARDS_KEY = 'anime.cards';

export async function loadKnown(db: DB): Promise<Set<string>> {
  return new Set((await getUserData<string[]>(db, KNOWN_KEY)) ?? []);
}
export const saveKnown = (db: DB, known: ReadonlySet<string>) => setUserData(db, KNOWN_KEY, [...known]);
export async function loadCards(db: DB): Promise<NewCard[]> {
  return (await getUserData<NewCard[]>(db, CARDS_KEY)) ?? [];
}

export interface CardPlan {
  cards: NewCard[];
  /** unknown words with no dictionary entry: no meaning to put on a card yet. */
  skippedNoMeaning: number;
}

/** Pure: which new cards should this subtitle file create? Most frequent unknown words first. */
export function planCards(
  lines: { cue: Cue; tokens: Token[] }[],
  known: ReadonlySet<string>,
  existing: readonly NewCard[],
  source: string,
  now = Date.now(),
  limit = Infinity
): CardPlan {
  const have = new Set(existing.map((c) => c.id));
  const freq = new Map<string, { token: Token; sentence: string; count: number }>();
  let skippedNoMeaning = 0;
  const skipped = new Set<string>();
  for (const { cue, tokens } of lines) {
    for (const t of tokens) {
      if (!t.countable || known.has(t.key)) continue;
      if (!t.entry) { skipped.add(t.key); continue; }
      const cur = freq.get(t.key);
      if (cur) cur.count++; else freq.set(t.key, { token: t, sentence: cue.text.replace(/\n/g, ' '), count: 1 });
    }
  }
  skippedNoMeaning = skipped.size;
  const cards = [...freq.values()]
    .filter((f) => !have.has(`anime:${f.token.key}`))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ token, sentence }): NewCard => ({
      id: `anime:${token.key}`,
      word: token.entry!.kanji || token.entry!.reading,
      reading: token.entry!.reading,
      meaning: token.entry!.meaning,
      sentence, source, createdAt: now
    }));
  return { cards, skippedNoMeaning };
}

export async function saveNewCards(db: DB, plan: CardPlan): Promise<number> {
  if (!plan.cards.length) return 0;
  const existing = await loadCards(db);
  await setUserData(db, CARDS_KEY, [...existing, ...plan.cards]);
  return plan.cards.length;
}

export function tokenizeCues(cues: Cue[], index: DictIndex, tokenize: (t: string, i: DictIndex) => Token[]) {
  return cues.map((cue) => ({ cue, tokens: tokenize(cue.text.replace(/\n/g, ''), index) }));
}
