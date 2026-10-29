// Converts open dictionary data into Yomineko content packs.
//   JMdict    (jmdict-simplified JSON, EDRDG, CC BY-SA 4.0)  -> collection `words`
//   Tatoeba examples carried inside that JSON (CC BY 2.0 FR) -> collection `examples`
//   KANJIDIC2 (jmdict-simplified JSON, EDRDG, CC BY-SA 4.0)  -> collection `kanji`
//   JLPT lists (tanos.co.uk, CC BY), optional                -> `jlpt` on words
//   frequency list, optional (one word per line, most frequent first) -> `rank` on words
// Pure functions: no file or network access, so they are unit-tested (src/features/dictionary/convert.test.ts).

const EDRDG = 'https://www.edrdg.org/edrdg/licence.html';

export const LICENSES = {
  jmdict: { name: 'CC BY-SA 4.0 (EDRDG)', url: EDRDG,
    attribution: 'JMdict/EDICT, © Electronic Dictionary Research and Development Group, dùng theo giấy phép của nhóm.' },
  examples: { name: 'CC BY 2.0 FR (Tatoeba)', url: 'https://creativecommons.org/licenses/by/2.0/fr/',
    attribution: 'Câu ví dụ từ Tatoeba (tatoeba.org) và những người đóng góp.' },
  kanjidic: { name: 'CC BY-SA 4.0 (EDRDG)', url: EDRDG,
    attribution: 'KANJIDIC2, © Electronic Dictionary Research and Development Group, dùng theo giấy phép của nhóm.' }
};

/** Parse the JLPT csv files ("expression,reading,meaning,tags" with a header) into [{expression, reading, level}]. */
export function parseJlptCsv(text, level) {
  const rows = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cols = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { cols.push(cur); cur = ''; }
      else cur += c;
    }
    cols.push(cur);
    if (cols[0]) rows.push({ expression: cols[0].trim(), reading: (cols[1] ?? '').trim(), level });
  }
  return rows;
}

/** Map "expression|reading" and "expression" -> easiest (highest N) level. */
export function buildJlptMap(rows) {
  const map = new Map();
  const put = (k, lv) => { if (!map.has(k) || map.get(k) < lv) map.set(k, lv); };
  for (const r of rows) { put(`${r.expression}|${r.reading}`, r.level); put(r.expression, r.level); }
  return map;
}

const refText = (ref) => (Array.isArray(ref) ? String(ref[0]) : String(ref));

/** One jmdict-simplified word -> Yomineko `words` record (+ the example records it links). */
export function convertWord(w, { jlpt, rankOf } = {}) {
  const kanji = (w.kanji ?? []).map((k) => ({ text: k.text, ...(k.common ? { common: true } : {}) }));
  const kana = (w.kana ?? []).map((k) => ({
    text: k.text, ...(k.common ? { common: true } : {}),
    ...(k.appliesToKanji?.length && !k.appliesToKanji.includes('*') ? { kanji: k.appliesToKanji } : {})
  }));
  const examples = [];
  const senses = (w.sense ?? []).map((s) => {
    for (const ex of s.examples ?? []) {
      const ja = ex.sentences?.find((x) => (x.land ?? x.lang) === 'jpn')?.text;
      const en = ex.sentences?.find((x) => (x.land ?? x.lang) === 'eng')?.text;
      if (ja && en) examples.push({ id: ex.source?.value ? `tat-${ex.source.value}` : `ex-${w.id}-${examples.length}`, ja, en });
    }
    return {
      pos: s.partOfSpeech ?? [], gloss: (s.gloss ?? []).filter((g) => !g.lang || g.lang === 'eng').map((g) => g.text),
      ...(s.related?.length ? { related: s.related.map(refText) } : {}),
      ...(s.antonym?.length ? { antonym: s.antonym.map(refText) } : {})
    };
  }).filter((s) => s.gloss.length);

  const common = kanji.some((k) => k.common) || kana.some((k) => k.common);
  let level;
  if (jlpt) {
    for (const k of kanji) for (const r of kana) level = Math.max(level ?? 0, jlpt.get(`${k.text}|${r.text}`) ?? 0);
    if (!level) for (const k of kanji) level = Math.max(level ?? 0, jlpt.get(k.text) ?? 0);
    if (!level && !kanji.length) for (const r of kana) level = Math.max(level ?? 0, jlpt.get(r.text) ?? 0);
  }
  const rank = rankOf ? [...kanji.map((k) => k.text), ...kana.map((k) => k.text)].map(rankOf).filter(Boolean).sort((a, b) => a - b)[0] : undefined;

  const word = {
    id: String(w.id), kanji, kana, senses, common,
    ...(level ? { jlpt: level } : {}), ...(rank ? { rank } : {}),
    ...(examples.length ? { ex: [...new Set(examples.map((e) => e.id))] } : {})
  };
  return { word, examples: examples.map((e) => ({ ...e, words: [word.id] })) };
}

export function convertKanji(c) {
  const groups = c.readingMeaning?.groups ?? [];
  const readings = groups.flatMap((g) => g.readings ?? []);
  const entry = {
    id: c.literal,
    on: readings.filter((r) => r.type === 'ja_on').map((r) => r.value),
    kun: readings.filter((r) => r.type === 'ja_kun').map((r) => r.value),
    meanings: groups.flatMap((g) => (g.meanings ?? []).filter((m) => m.lang === 'en').map((m) => m.value)),
    ...(c.misc?.strokeCounts?.[0] ? { strokes: c.misc.strokeCounts[0] } : {}),
    ...(c.misc?.grade ? { grade: c.misc.grade } : {}),
    ...(c.misc?.frequency ? { freq: c.misc.frequency } : {}),
    ...(c.misc?.jlptLevel ? { jlptOld: c.misc.jlptLevel } : {})
  };
  return entry;
}

const manifest = (id, title, version, license) => ({ format: 1, id, kind: 'dictionary', title, version, license });

/**
 * Build the three packs.
 * @param {{jmdict?: object, kanjidic?: object, jlptRows?: object[], freqWords?: string[], version: number, commonOnly?: boolean}} o
 */
export function buildPacks({ jmdict, kanjidic, jlptRows, freqWords, version, commonOnly = true }) {
  const out = {};
  if (jmdict) {
    const jlpt = jlptRows?.length ? buildJlptMap(jlptRows) : undefined;
    const ranks = freqWords ? new Map(freqWords.map((w, i) => [w, i + 1]).reverse()) : undefined;
    const rankOf = ranks ? (t) => ranks.get(t) : undefined;
    const words = [], examples = new Map();
    for (const w of jmdict.words) {
      const r = convertWord(w, { jlpt, rankOf });
      if (commonOnly && !r.word.common) continue;
      if (!r.word.senses.length) continue;
      words.push(r.word);
      for (const e of r.examples) {
        const cur = examples.get(e.id);
        if (cur) cur.words.push(...e.words); else examples.set(e.id, e);
      }
    }
    // keep only examples whose words are all kept (they are, by construction) and drop dangling refs
    out['jmdict-words'] = { manifest: manifest('jmdict-words', `Từ điển JMdict${commonOnly ? ' (từ thông dụng)' : ''}`, version, LICENSES.jmdict), upserts: { words } };
    if (examples.size) {
      out['jmdict-examples'] = { manifest: manifest('jmdict-examples', 'Câu ví dụ (Tatoeba)', version, LICENSES.examples), upserts: { examples: [...examples.values()] } };
    }
  }
  if (kanjidic) {
    out['kanjidic'] = { manifest: manifest('kanjidic', 'Chữ Hán KANJIDIC2', version, LICENSES.kanjidic), upserts: { kanji: kanjidic.characters.map(convertKanji) } };
  }
  return out;
}
