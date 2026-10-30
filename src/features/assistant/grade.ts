import type { Turn } from './scenarios';

/** Label shown to learners: offline grading only compares text, it does not understand Japanese. */
export const SIMPLE_GRADING_LABEL = 'Chấm đơn giản';
export const PASS_SCORE = 0.6;

const normalize = (s: string) => s.replace(/[\s、。，．,.!?！？「」『』〜~・]/g, '');

const bigrams = (s: string) => {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
  return m;
};

/** Dice coefficient on character pairs, 0..1. Order-insensitive but needs real overlap, so "はい" alone cannot match a full sentence. */
export function similarity(a: string, b: string): number {
  const x = bigrams(normalize(a)), y = bigrams(normalize(b));
  let nx = 0, ny = 0, common = 0;
  for (const v of x.values()) nx += v;
  for (const v of y.values()) ny += v;
  if (nx === 0 || ny === 0) return 0;
  for (const [k, v] of x) common += Math.min(v, y.get(k) ?? 0);
  return (2 * common) / (nx + ny);
}

export interface Grade { ok: boolean; score: number }

/** Needs a keyword hit AND (a match of the turn's pattern OR enough similarity to the model/alternative answers). */
export function gradeAnswer(text: string, turn: Turn): Grade {
  const t = text.trim();
  const score = Math.max(...[turn.model, ...(turn.alts ?? [])].map((m) => similarity(t, m)));
  const keyword = turn.expect.some((k) => t.includes(k));
  const patterned = !!turn.pattern && new RegExp(turn.pattern).test(normalize(t));
  return { ok: keyword && (patterned || score >= PASS_SCORE), score };
}
