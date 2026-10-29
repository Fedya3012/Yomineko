// In-memory search index over the `words` collection. Built once after packs are loaded;
// everything below works offline and without a server.
import { hasJapanese, isKanji, normalize, romajiToHiragana } from './kana';
import type { SearchHit, Word } from './types';

const tokenize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9]+/g) ?? [];

/** Index of keys -> word positions, with binary-searchable sorted keys for prefix lookups. */
class KeyMap {
  private map = new Map<string, number[]>();
  private sorted: string[] | undefined;
  add(key: string, i: number) {
    if (!key) return;
    const list = this.map.get(key);
    if (!list) this.map.set(key, [i]);
    else if (list[list.length - 1] !== i) list.push(i);
    this.sorted = undefined;
  }
  exact(key: string) { return this.map.get(key) ?? []; }
  prefix(key: string, limit: number): { key: string; ids: number[] }[] {
    const keys = (this.sorted ??= [...this.map.keys()].sort());
    let lo = 0, hi = keys.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (keys[mid] < key) lo = mid + 1; else hi = mid; }
    const out: { key: string; ids: number[] }[] = [];
    for (let i = lo; i < keys.length && keys[i].startsWith(key) && out.length < limit; i++) {
      out.push({ key: keys[i], ids: this.map.get(keys[i])! });
    }
    return out;
  }
}

export class DictionaryIndex {
  readonly words: Word[];
  private byId = new Map<string, number>();
  private forms = new KeyMap();      // kanji spellings + readings (normalised)
  private glosses = new KeyMap();    // lower-case English tokens
  private phrases = new Map<string, number[]>(); // whole gloss text -> words ("cat" exactly)
  private byKanjiChar = new Map<string, number[]>();

  constructor(words: Word[]) {
    this.words = words;
    words.forEach((w, i) => {
      this.byId.set(w.id, i);
      for (const k of w.kanji) {
        this.forms.add(normalize(k.text), i);
        for (const ch of k.text) if (isKanji(ch)) {
          const l = this.byKanjiChar.get(ch);
          if (!l) this.byKanjiChar.set(ch, [i]); else if (l[l.length - 1] !== i) l.push(i);
        }
      }
      for (const k of w.kana) this.forms.add(normalize(k.text), i);
      for (const s of w.senses) for (const g of s.gloss) {
        for (const t of tokenize(g)) this.glosses.add(t, i);
        const p = g.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
        const l = this.phrases.get(p);
        if (!l) this.phrases.set(p, [i]); else if (l[l.length - 1] !== i) l.push(i);
      }
    });
  }

  get size() { return this.words.length; }
  get(id: string): Word | undefined { const i = this.byId.get(id); return i === undefined ? undefined : this.words[i]; }

  /** Words whose spelling or reading is exactly `text` (katakana/hiragana are treated alike). */
  findByForm(text: string): Word[] {
    return this.forms.exact(normalize(text)).map((i) => this.words[i]);
  }

  /** Other words that share a kanji with `word`, most useful first. */
  withKanji(ch: string): Word[] {
    return (this.byKanjiChar.get(ch) ?? []).map((i) => this.words[i]);
  }

  search(query: string, limit = 30): SearchHit[] {
    const q = query.normalize('NFKC').trim();
    if (!q) return [];
    const best = new Map<number, { score: number; matched: SearchHit['matched'] }>();
    const bump = (i: number, score: number, matched: SearchHit['matched']) => {
      const cur = best.get(i);
      if (!cur || cur.score < score) best.set(i, { score, matched });
    };
    const formSearch = (key: string, matched: SearchHit['matched'], scale = 1) => {
      for (const i of this.forms.exact(key)) bump(i, 1000 * scale, matched);
      for (const { key: k, ids } of this.forms.prefix(key, 200)) {
        if (k === key) continue;
        const closeness = 1 - Math.min(0.5, (k.length - key.length) / (k.length * 2));
        for (const i of ids) bump(i, 600 * scale * closeness, matched);
      }
    };

    if (hasJapanese(q)) {
      formSearch(normalize(q), /[㐀-鿿]/.test(q) ? 'form' : 'reading');
    } else {
      const kana = romajiToHiragana(q);
      if (kana) formSearch(kana, 'reading', 0.9);
      const tokens = tokenize(q);
      if (tokens.length) this.glossSearch(q, tokens, bump);
    }

    return [...best.entries()]
      .map(([i, { score, matched }]) => ({ word: this.words[i], score: score + this.bonus(this.words[i]), matched }))
      .sort((a, b) => b.score - a.score || a.word.id.localeCompare(b.word.id))
      .slice(0, limit);
  }

  private glossSearch(q: string, tokens: string[], bump: (i: number, score: number, m: SearchHit['matched']) => void) {
    for (const i of this.phrases.get(q.toLowerCase()) ?? []) bump(i, 800, 'gloss');
    // every token must appear as a gloss word; the last token may be a prefix ("cat" -> "catch")
    let candidates: Set<number> | undefined;
    tokens.forEach((t, n) => {
      const isLast = n === tokens.length - 1;
      const hit = new Set<number>(this.glosses.exact(t));
      if (isLast && t.length >= 2) for (const { ids } of this.glosses.prefix(t, 50)) ids.forEach((i) => hit.add(i));
      candidates = candidates ? new Set([...candidates].filter((i) => hit.has(i))) : hit;
    });
    for (const i of candidates ?? []) {
      const exact = tokens.every((t) => this.glosses.exact(t).includes(i));
      bump(i, exact ? 500 : 250, 'gloss');
    }
  }

  private bonus(w: Word): number {
    let b = w.common ? 200 : 0;
    if (w.jlpt) b += (6 - w.jlpt) * 15;
    if (w.rank) b += Math.max(0, 100 - w.rank / 100);
    return b;
  }
}
