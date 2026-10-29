// Converts Jitendex (https://jitendex.org, Yomitan "term bank" format, CC BY-SA 4.0) into a Yomineko content pack.
//   term bank row = [term, reading, defTags, rules, score, definitions, sequence, termTags]
//   `sequence` is the JMdict entry number, the same as the id of our `words` records (jmdict-simplified),
//   so the popup can show Jitendex's meanings next to JMdict's for the same word without any matching by spelling.
// Result goes to collection `jitendex`: one record per JMdict entry, with sense groups kept as Jitendex wrote them.
// Pure functions: no file or network access, so they are unit-tested (src/features/dictionary/jitendex.test.ts).

export const JITENDEX_LICENSE = {
  name: 'CC BY-SA 4.0 (Jitendex)',
  url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  attribution:
    'Jitendex, © Stephen Kraus 2023-2026, CC BY-SA 4.0 (jitendex.org). Dựa trên JMdict của EDRDG (edrdg.org) ' +
    'và câu ví dụ của Tatoeba (CC BY 2.0 FR).'
};

const dataOf = (n) => (n && typeof n === 'object' && !Array.isArray(n) ? n.data ?? {} : {});
const kindOf = (n) => dataOf(n).content;
const kids = (n) => (n == null ? [] : Array.isArray(n) ? n : [n]);

/** Plain text of a structured-content node. Furigana (<rt>) is dropped so "握り締める" stays readable. */
export function textOf(n) {
  if (n == null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textOf).join('');
  if (n.tag === 'rt' || n.tag === 'rp') return '';
  return textOf(n.content);
}

/** First descendant (depth-first) whose data.content is `kind`. */
function find(n, kind) {
  for (const c of kids(n)) {
    if (c && typeof c === 'object') {
      if (kindOf(c) === kind) return c;
      const hit = find(c.content, kind);
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Topmost descendants with data.content === kind (does not look inside a match). */
function collect(n, kind, out = []) {
  for (const c of kids(n)) {
    if (c && typeof c === 'object') {
      if (kindOf(c) === kind) out.push(c);
      else collect(c.content, kind, out);
    }
  }
  return out;
}

const TAG_KIND = { 'part-of-speech-info': 'pos', 'misc-info': 'tags', 'field-info': 'tags', 'dialect-info': 'tags' };

/** Tag spans that are direct children of `node`: { pos: [...codes], tags: [...codes] }. */
function tagsOf(node) {
  const out = { pos: [], tags: [] };
  for (const c of kids(node.content)) {
    const bucket = c && typeof c === 'object' && dataOf(c).class === 'tag' ? TAG_KIND[kindOf(c)] : undefined;
    if (bucket && dataOf(c).code) out[bucket].push(String(dataOf(c).code));
  }
  return out;
}

function exampleOf(node) {
  const box = find(node, 'example-sentence');
  if (!box) return undefined;
  const ja = textOf(find(box, 'example-sentence-a')).trim();
  const enNode = find(box, 'example-sentence-b');
  const en = enNode ? textOf(withoutFootnotes(enNode)).trim() : '';
  return ja && en ? { ja, en } : undefined;
}
function withoutFootnotes(n) {
  if (Array.isArray(n)) return n.map(withoutFootnotes);
  if (n && typeof n === 'object') return kindOf(n) === 'attribution-footnote' ? '' : { ...n, content: withoutFootnotes(n.content) };
  return n;
}

function senseOf(node, groupTags) {
  const own = tagsOf(node);
  const glossNode = find(node, 'glossary');
  // A sense whose only content is an "Explanation" box has no glossary: that text is the meaning.
  const gloss = glossNode
    ? (Array.isArray(glossNode.content) ? glossNode.content : [glossNode.content]).map((li) => textOf(li).trim()).filter(Boolean)
    : collect(node, 'info-gloss').map((g) => textOf(find(g, 'info-gloss-content')).trim()).filter(Boolean);
  if (!gloss.length) return undefined;
  const notes = collect(node, 'sense-note').map((n) => textOf(find(n, 'sense-note-content')).trim()).filter(Boolean);
  // The "wasei" badge (made-in-Japan word) is a sibling span glued to the text; keep only the origin.
  const lang = textOf(find(node, 'lang-source-content')).replace(/wasei$/, '').trim();
  const ex = exampleOf(node);
  const tags = [...new Set([...groupTags.tags, ...own.tags])];
  return {
    pos: [...new Set([...groupTags.pos, ...own.pos])], gloss,
    ...(tags.length ? { tags } : {}), ...(notes.length ? { note: notes } : {}),
    ...(lang ? { lang } : {}), ...(ex ? { ex } : {})
  };
}

/** The senses of one term-bank row ([] for redirect rows such as "Ｎ響 ⟶ Ｎ響"). */
export function sensesOfRow(row) {
  const out = [];
  for (const def of row[5] ?? []) {
    if (!def || typeof def !== 'object' || Array.isArray(def)) continue;
    for (const group of collect(def.content, 'sense-group')) {
      const groupTags = tagsOf(group);
      const senseNodes = collect(group.content, 'sense');
      for (const s of senseNodes) { const sense = senseOf(s, groupTags); if (sense) out.push(sense); }
    }
  }
  return out;
}

/**
 * Term-bank rows -> `jitendex` records. Rows of one entry (one per spelling/reading) repeat the same
 * senses, so the first row that has senses wins. Redirect rows (negative sequence) are skipped.
 */
export function convertRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    const seq = row[6];
    if (!Number.isInteger(seq) || seq <= 0 || byId.has(String(seq))) continue;
    const senses = sensesOfRow(row);
    if (senses.length) byId.set(String(seq), { id: String(seq), senses });
  }
  return [...byId.values()];
}

export function buildJitendexPack({ rows, version, title = 'Từ điển Jitendex' }) {
  return {
    manifest: { format: 1, id: 'dict-jitendex', kind: 'dictionary', title, version, license: JITENDEX_LICENSE },
    upserts: { jitendex: convertRows(rows) }
  };
}
