import type { CardContent, QuestionType } from './types';

export type Question =
  | { type: 'meaning'; card: CardContent; choices: string[]; answer: number }   // see reading -> pick meaning
  | { type: 'audio'; card: CardContent; choices: string[]; answer: number }     // hear it -> pick the kanji word
  | { type: 'blank'; card: CardContent; sentence: string; choices: string[]; answer: number }
  | { type: 'handwrite'; card: CardContent }                                    // write the word, then self-check
  | { type: 'recall'; card: CardContent };                                      // fallback: too few cards for choices

export const hasKanji = (s: string) => /[一-鿿々]/.test(s);
export const BLANK_MARK = '＿＿＿';

export function availableTypes(card: CardContent): QuestionType[] {
  const out: QuestionType[] = ['meaning'];
  if (hasKanji(card.word)) out.push('audio', 'handwrite');
  if (card.example && card.example.ja.includes(card.example.blank)) out.push('blank');
  return out;
}

/** Picks the type for this review: rotates through what is available so the same card is asked in different ways. */
export function chooseType(card: CardContent, reps: number, enabled: QuestionType[]): QuestionType | 'recall' {
  const usable = availableTypes(card).filter((t) => enabled.includes(t));
  return usable.length ? usable[reps % usable.length] : 'recall';
}

type Rng = () => number;
function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Answer + up to `count - 1` distinct wrong options taken from other cards. */
function options(correct: string, others: string[], count: number, rng: Rng) {
  const wrong = shuffle([...new Set(others.filter((o) => o && o !== correct))], rng).slice(0, count - 1);
  const choices = shuffle([correct, ...wrong], rng);
  return { choices, answer: choices.indexOf(correct) };
}

export function makeQuestion(card: CardContent, type: QuestionType | 'recall', pool: CardContent[], rng: Rng = Math.random): Question {
  const others = pool.filter((c) => c.id !== card.id);
  const build = (correct: string, pick: (c: CardContent) => string) => options(correct, others.map(pick), 4, rng);

  if (type === 'handwrite') return { type, card };
  if (type === 'meaning') {
    const o = build(card.meaning, (c) => c.meaning);
    if (o.choices.length >= 2) return { type, card, ...o };
  } else if (type === 'audio') {
    const o = build(card.word, (c) => c.word);
    if (o.choices.length >= 2) return { type, card, ...o };
  } else if (type === 'blank' && card.example) {
    const o = build(card.example.blank, (c) => c.word);
    if (o.choices.length >= 2) {
      return { type, card, sentence: card.example.ja.replace(card.example.blank, BLANK_MARK), ...o };
    }
  }
  return { type: 'recall', card };
}
