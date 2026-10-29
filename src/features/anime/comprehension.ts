// Comprehension Score = percent of the words in the subtitles that the learner already knows.
import type { Token } from './tokenizer';

export interface Score {
  percent: number;      // 0..100, rounded
  known: number;
  total: number;
  unknownKeys: string[];
}

/** Score a group of token lists. `unique` counts each distinct word once (vocabulary coverage);
 *  otherwise every occurrence counts (what you actually experience while watching). */
export function comprehension(lines: Token[][], known: ReadonlySet<string>, unique = false): Score {
  const seen = new Set<string>();
  const unknownKeys = new Set<string>();
  let knownCount = 0, total = 0;
  for (const line of lines) {
    for (const t of line) {
      if (!t.countable) continue;
      if (unique) { if (seen.has(t.key)) continue; seen.add(t.key); }
      total++;
      if (known.has(t.key)) knownCount++; else unknownKeys.add(t.key);
    }
  }
  return {
    percent: total === 0 ? 100 : Math.round((knownCount / total) * 100),
    known: knownCount,
    total,
    unknownKeys: [...unknownKeys]
  };
}
