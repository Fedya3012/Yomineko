// Kana helpers shared by the search index and the lookup code.

/** Katakana -> hiragana (leaves ー and everything else alone). */
export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** Normalised form used as an index key: NFKC, lower-case, hiragana. */
export const normalize = (s: string) => kataToHira(s.normalize('NFKC').trim().toLowerCase());

export const hasJapanese = (s: string) => /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(s);
export const isKanji = (c: string) => /[㐀-鿿豈-﫿]/.test(c);

const VOWELS = ['a', 'i', 'u', 'e', 'o'];
const ROWS: Record<string, string> = {
  '': 'あいうえお', k: 'かきくけこ', g: 'がぎぐげご', s: 'さしすせそ', z: 'ざじずぜぞ', t: 'たちつてと',
  d: 'だぢづでど', n: 'なにぬねの', h: 'はひふへほ', b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ', m: 'まみむめも', r: 'らりるれろ'
};
const SMALL = { a: 'ゃ', u: 'ゅ', o: 'ょ' } as const;

const TABLE = new Map<string, string>();
for (const [c, kana] of Object.entries(ROWS)) {
  [...kana].forEach((k, i) => TABLE.set(c + VOWELS[i], k));
  // きゃ きゅ きょ ...
  if (c && c !== 'z' && c !== 'd') for (const v of ['a', 'u', 'o'] as const) TABLE.set(`${c}y${v}`, kana[1] + SMALL[v]);
}
const extra: [string, string][] = [
  ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'], ['wa', 'わ'], ['wo', 'を'],
  ['si', 'し'], ['shi', 'し'], ['sha', 'しゃ'], ['shu', 'しゅ'], ['sho', 'しょ'], ['she', 'しぇ'],
  ['ti', 'ち'], ['chi', 'ち'], ['cha', 'ちゃ'], ['chu', 'ちゅ'], ['cho', 'ちょ'], ['che', 'ちぇ'],
  ['tu', 'つ'], ['tsu', 'つ'], ['hu', 'ふ'], ['fu', 'ふ'], ['fa', 'ふぁ'], ['fi', 'ふぃ'], ['fe', 'ふぇ'], ['fo', 'ふぉ'],
  ['zi', 'じ'], ['ji', 'じ'], ['ja', 'じゃ'], ['ju', 'じゅ'], ['jo', 'じょ'], ['je', 'じぇ'],
  ['di', 'ぢ'], ['du', 'づ'], ['tsa', 'つぁ'], ['wi', 'ゐ'], ['we', 'ゑ']
];
for (const [r, k] of extra) TABLE.set(r, k);

/**
 * Typed romaji -> hiragana (Hepburn + common kunrei variants). Returns null when any part is not
 * valid romaji, so "cat" is *not* mistaken for a reading query while "neko" is.
 */
export function romajiToHiragana(input: string): string | null {
  const s = input.normalize('NFKC').toLowerCase().replace(/ā/g, 'aa').replace(/ī/g, 'ii').replace(/ū/g, 'uu')
    .replace(/ē/g, 'ee').replace(/ō/g, 'ou');
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === "'" || c === '-') { if (c === '-') out += 'ー'; i++; continue; }
    // sokuon: doubled consonant (but not "nn")
    if (i + 1 < s.length && c === s[i + 1] && /[kgsztdhbpmrfjcvwy]/.test(c)) { out += 'っ'; i++; continue; }
    let hit = false;
    for (const len of [3, 2, 1]) {
      const k = TABLE.get(s.slice(i, i + len));
      if (k) { out += k; i += len; hit = true; break; }
    }
    if (hit) continue;
    if (c === 'n') { out += 'ん'; i++; continue; } // n before a consonant or at the end
    return null;
  }
  return out || null;
}
