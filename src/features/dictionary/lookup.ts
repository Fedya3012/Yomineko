// "Tap any word": find the dictionary entry starting at a position in a running text,
// including simple verb / i-adjective conjugations (読みました -> 読む).
import type { DictionaryIndex } from './index';
import type { Word } from './types';

interface Rule { suffix: string; to: string; pos: RegExp; whole?: boolean }

const GODAN: [end: string, iStem: string, aStem: string, te: string, ta: string][] = [
  ['う', 'い', 'わ', 'って', 'った'], ['く', 'き', 'か', 'いて', 'いた'], ['ぐ', 'ぎ', 'が', 'いで', 'いだ'],
  ['す', 'し', 'さ', 'して', 'した'], ['つ', 'ち', 'た', 'って', 'った'], ['ぬ', 'に', 'な', 'んで', 'んだ'],
  ['ぶ', 'び', 'ば', 'んで', 'んだ'], ['む', 'み', 'ま', 'んで', 'んだ'], ['る', 'り', 'ら', 'って', 'った']
];
const V5 = /^v5/, V1 = /^v1/, ADJ = /^adj-i/, SURU = /^vs/, KURU = /^vk/;

function buildRules(): Rule[] {
  const rules: Rule[] = [];
  const add = (suffix: string, to: string, pos: RegExp, whole = false) => rules.push({ suffix, to, pos, whole });

  for (const [end, i, a, te, ta] of GODAN) {
    for (const s of ['ます', 'ました', 'ません', 'たい', 'たくない']) add(i + s, end, V5);
    for (const s of ['ない', 'なかった', 'れる', 'せる']) add(a + s, end, V5);
    add(te + 'いる', end, V5); add(te + 'いた', end, V5); add(te + 'います', end, V5);
    add(te, end, V5); add(ta, end, V5);
  }
  // 行く is irregular in te/ta
  for (const [s, to] of [['行って', '行く'], ['行った', '行く'], ['いって', 'いく'], ['いった', 'いく']] as const) add(s, to, V5, true);

  for (const s of ['ます', 'ました', 'ません', 'ない', 'なかった', 'た', 'て', 'たい', 'ている', 'ていた', 'ています', 'られる', 'よう'])
    add(s, 'る', V1);

  for (const [s, to] of [['します', 'する'], ['しました', 'する'], ['しません', 'する'], ['しない', 'する'], ['した', 'する'],
    ['して', 'する'], ['している', 'する'], ['していた', 'する'], ['しよう', 'する']] as const) add(s, to, SURU, true);
  for (const [s, to] of [['きます', 'くる'], ['きました', 'くる'], ['こない', 'くる'], ['きた', 'くる'], ['きて', 'くる'],
    ['来ます', '来る'], ['来ました', '来る'], ['来ない', '来る'], ['来た', '来る'], ['来て', '来る']] as const) add(s, to, KURU, true);

  for (const [s, to] of [['くない', 'い'], ['かった', 'い'], ['くなかった', 'い'], ['くて', 'い'], ['く', 'い'], ['さ', 'い']] as const)
    add(s, to, ADJ);
  return rules;
}
const RULES = buildRules();

/** Dictionary-form candidates for a conjugated surface. */
export function deinflect(surface: string): { base: string; rule: Rule }[] {
  const out: { base: string; rule: Rule }[] = [];
  for (const rule of RULES) {
    if (surface.endsWith(rule.suffix) && (rule.whole || surface.length > rule.suffix.length)) {
      out.push({ base: surface.slice(0, -rule.suffix.length) + rule.to, rule });
    }
  }
  return out;
}

export interface LookupResult {
  /** The text that was matched, as written in the source. */
  surface: string;
  /** Number of characters (code points) matched, for highlighting. */
  length: number;
  words: Word[];
  /** Set when the surface was a conjugated form of `words`. */
  deinflectedFrom?: string;
}

/**
 * Longest dictionary match starting at code point `pos` of `text`.
 * Prefers longer matches; at equal length prefers an exact entry over a conjugated one.
 */
export function lookupAt(index: DictionaryIndex, text: string, pos: number, maxLength = 12): LookupResult | null {
  const chars = Array.from(text);
  if (pos < 0 || pos >= chars.length) return null;
  for (let len = Math.min(maxLength, chars.length - pos); len >= 1; len--) {
    const surface = chars.slice(pos, pos + len).join('');
    const exact = index.findByForm(surface);
    if (exact.length) return { surface, length: len, words: exact };
    const conj: Word[] = [];
    for (const { base, rule } of deinflect(surface)) {
      for (const w of index.findByForm(base)) {
        if (!conj.includes(w) && w.senses.some((s) => s.pos.some((p) => rule.pos.test(p)))) conj.push(w);
      }
    }
    if (conj.length) return { surface, length: len, words: conj, deinflectedFrom: surface };
  }
  return null;
}
