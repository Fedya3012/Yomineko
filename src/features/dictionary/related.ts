// "Related words" shown in the word popup.
import type { DictionaryIndex } from './index';
import { isKanji } from './kana';
import type { Word } from './types';

export interface Related {
  /** Cross-references written in the dictionary entry itself (e.g. 'see also'). */
  seeAlso: Word[];
  antonyms: Word[];
  /** Other words written with the same kanji, most common first. */
  sameKanji: Word[];
}

const rank = (w: Word) => (w.common ? 0 : 1000) + (w.jlpt ? 6 - w.jlpt : 0) * -10 + (w.rank ?? 500);

export function relatedWords(index: DictionaryIndex, word: Word, limit = 8): Related {
  const seen = new Set<string>([word.id]);
  const resolve = (refs: string[] | undefined): Word[] => {
    const out: Word[] = [];
    for (const ref of refs ?? []) {
      const text = ref.split('・')[0]; // JMdict writes "猫・1" or "猫・ねこ・1"; the first part is the spelling
      const hit = index.findByForm(text).find((w) => !seen.has(w.id));
      if (hit) { seen.add(hit.id); out.push(hit); }
    }
    return out;
  };
  const seeAlso = resolve(word.senses.flatMap((s) => s.related ?? []));
  const antonyms = resolve(word.senses.flatMap((s) => s.antonym ?? []));

  const kanjis = new Set([...(word.kanji[0]?.text ?? '')].filter(isKanji));
  const pool = new Map<string, Word>();
  for (const ch of kanjis) for (const w of index.withKanji(ch)) if (!seen.has(w.id)) pool.set(w.id, w);
  const sameKanji = [...pool.values()].sort((a, b) => rank(a) - rank(b)).slice(0, limit);
  return { seeAlso: seeAlso.slice(0, limit), antonyms: antonyms.slice(0, limit), sameKanji };
}
