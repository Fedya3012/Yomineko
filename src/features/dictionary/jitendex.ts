// Jitendex as a second meaning source next to JMdict (pack `dict-jitendex`, collection `jitendex`).
// Pure helpers only; loading from the database lives in state.svelte.ts.
import type { JitendexEntry, JitendexSense } from './types';

export const JITENDEX_PACK_ID = 'dict-jitendex';
export const SOURCE_KEY = 'dict.source';

/** Which meanings the word popup shows. */
export type MeaningSource = 'both' | 'jmdict' | 'jitendex';
export const MEANING_SOURCES: [MeaningSource, string][] = [['both', 'Cả hai'], ['jmdict', 'JMdict'], ['jitendex', 'Jitendex']];

export function parseSource(raw: unknown): MeaningSource {
  return raw === 'jmdict' || raw === 'jitendex' || raw === 'both' ? raw : 'both';
}

/**
 * What to draw for one word. Without the Jitendex pack, or when it has no entry for this word,
 * JMdict is always shown, so a choice of "Jitendex only" never leaves the popup empty.
 */
export function visibleSources(source: MeaningSource, entry: JitendexEntry | undefined): { jmdict: boolean; jitendex: boolean } {
  const jitendex = !!entry && source !== 'jmdict';
  return { jitendex, jmdict: source !== 'jitendex' || !jitendex };
}

export interface SenseGroup { pos: string[]; senses: JitendexSense[] }

/** Consecutive senses with the same parts of speech share one heading, the way Jitendex shows them. */
export function groupSenses(senses: JitendexSense[]): SenseGroup[] {
  const groups: SenseGroup[] = [];
  for (const s of senses) {
    const last = groups[groups.length - 1];
    if (last && last.pos.join() === s.pos.join()) last.senses.push(s);
    else groups.push({ pos: s.pos, senses: [s] });
  }
  return groups;
}

/** Short meaning line for cards: the first glosses of the first senses. */
export function jitendexGloss(entry: JitendexEntry, max = 3): string {
  return entry.senses.flatMap((s) => s.gloss).slice(0, max).join('; ');
}

/** Search text of a Jitendex entry (all glosses), for callers that want to match English. */
export const jitendexText = (entry: JitendexEntry) => entry.senses.flatMap((s) => s.gloss).join(' ').toLowerCase();
