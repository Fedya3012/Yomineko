// Luyện nghe và nhận mặt chữ nhanh. Phần logic thuần (không dính giao diện) để dễ kiểm thử.
import type { Kana } from './types';

export type DrillMode = 'char-to-romaji' | 'romaji-to-char' | 'listen';

export interface Question {
  mode: DrillMode;
  target: Kana;
  choices: Kana[];          // luôn chứa target, đã xáo trộn
}

export interface Answer { id: string; correct: boolean; ms: number }

/** Bộ sinh số ngẫu nhiên có hạt giống, để test lặp lại được. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rnd: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Chọn chữ gây nhầm: ưu tiên cùng hàng (か き く...), rồi lấy ngẫu nhiên cho đủ. Không có hai lựa chọn cùng cách đọc. */
export function pickDistractors(target: Kana, pool: readonly Kana[], count: number, rnd: () => number): Kana[] {
  const others = pool.filter((k) => k.id !== target.id && k.romaji !== target.romaji);
  const near = shuffle(others.filter((k) => k.row === target.row), rnd);
  const far = shuffle(others.filter((k) => k.row !== target.row), rnd);
  const out: Kana[] = [];
  for (const k of [...near.slice(0, Math.ceil(count / 2)), ...far, ...near]) {
    if (out.length >= count) break;
    if (!out.some((o) => o.romaji === k.romaji)) out.push(k);
  }
  return out;
}

/** Tạo `count` câu hỏi; chữ yếu (`weak`) được đưa vào nhiều hơn. */
export function makeQuestions(
  pool: readonly Kana[], count: number, mode: DrillMode, rnd: () => number = Math.random, weak: ReadonlySet<string> = new Set()
): Question[] {
  if (pool.length < 4) throw new Error('Cần ít nhất 4 chữ để tạo câu hỏi');
  const weighted = pool.flatMap((k) => (weak.has(k.id) ? [k, k, k] : [k]));
  const questions: Question[] = [];
  let bag: Kana[] = [];
  while (questions.length < count) {
    if (bag.length === 0) bag = shuffle(weighted, rnd);
    const target = bag.pop()!;
    if (questions.length && questions[questions.length - 1].target.id === target.id) continue;
    const choices = shuffle([target, ...pickDistractors(target, pool, 3, rnd)], rnd);
    questions.push({ mode, target, choices });
  }
  return questions;
}

export function isCorrect(q: Question, choiceId: string): boolean {
  return q.target.id === choiceId;
}

export interface DrillSummary { total: number; correct: number; accuracy: number; avgMs: number; weak: string[] }

export function summarizeDrill(answers: readonly Answer[]): DrillSummary {
  const correct = answers.filter((a) => a.correct).length;
  const avgMs = answers.length ? Math.round(answers.reduce((s, a) => s + a.ms, 0) / answers.length) : 0;
  const weak = [...new Set(answers.filter((a) => !a.correct).map((a) => a.id))];
  return { total: answers.length, correct, accuracy: answers.length ? correct / answers.length : 0, avgMs, weak };
}
