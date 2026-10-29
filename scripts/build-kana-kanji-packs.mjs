// Tạo hai gói nội dung từ dữ liệu mở:
//   packs-src/kana-core/v1.json         : hiragana + katakana (nét viết từ KanjiVG)
//   packs-src/kanji-grade1/v1.json      : 80 kanji lớp 1 (KANJIDIC + KanjiVG + nội dung tự viết)
// Dùng:  node scripts/build-kana-kanji-packs.mjs [thư-mục-cache]
// Cần mạng lần đầu; các file tải về được lưu vào thư mục cache để chạy lại không tải nữa.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CURATED } from './kanji-curated.mjs';

const CACHE = process.argv[2] ?? join(process.env.TMPDIR ?? '/tmp', 'yomineko-kanji-cache');
const OUT = 'packs-src';
const RAW = 'https://raw.githubusercontent.com';
const KANJIVG = `${RAW}/KanjiVG/kanjivg/master/kanji`;
const KANJI_JSON = `${RAW}/davidluzgouveia/kanji-data/master/kanji.json`;

async function cached(name, url) {
  const file = join(CACHE, name);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tải ${url} lỗi ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFile(file, 'utf8');
}

const hex = (ch) => ch.codePointAt(0).toString(16).padStart(5, '0');
/** Làm tròn số trong đường nét xuống 1 chữ số thập phân và viết lại với dấu phẩy, để file gọn mà vẫn đúng cú pháp. */
const round = (d) =>
  [...d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)]
    .map(([, cmd, args]) => cmd + (args.match(/-?\d*\.?\d+/g) ?? []).map((n) => String(Math.round(parseFloat(n) * 10) / 10 || 0)).join(','))
    .join('');

/** Đọc một file KanjiVG: danh sách nét + bộ thủ. */
function parseKanjiVG(svg) {
  const strokes = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s\d+"[^>]*? d="([^"]+)"/g)].map((m) => round(m[1]));
  const rads = [...svg.matchAll(/kvg:element="([^"]+)"[^>]*?kvg:radical="(\w+)"/g)].map((m) => ({ el: m[1], kind: m[2] }));
  const pick = rads.find((r) => r.kind === 'general') ?? rads.find((r) => r.kind === 'tradit') ?? rads[0];
  return { strokes, radical: pick?.el };
}

// ---------- Kana ----------
const ROWS = [
  ['a', ['あ:a', 'い:i', 'う:u', 'え:e', 'お:o']],
  ['ka', ['か:ka', 'き:ki', 'く:ku', 'け:ke', 'こ:ko']],
  ['sa', ['さ:sa', 'し:shi', 'す:su', 'せ:se', 'そ:so']],
  ['ta', ['た:ta', 'ち:chi', 'つ:tsu', 'て:te', 'と:to']],
  ['na', ['な:na', 'に:ni', 'ぬ:nu', 'ね:ne', 'の:no']],
  ['ha', ['は:ha', 'ひ:hi', 'ふ:fu', 'へ:he', 'ほ:ho']],
  ['ma', ['ま:ma', 'み:mi', 'む:mu', 'め:me', 'も:mo']],
  ['ya', ['や:ya', 'ゆ:yu', 'よ:yo']],
  ['ra', ['ら:ra', 'り:ri', 'る:ru', 'れ:re', 'ろ:ro']],
  ['wa', ['わ:wa', 'を:wo', 'ん:n']],
  ['ga', ['が:ga', 'ぎ:gi', 'ぐ:gu', 'げ:ge', 'ご:go']],
  ['za', ['ざ:za', 'じ:ji', 'ず:zu', 'ぜ:ze', 'ぞ:zo']],
  ['da', ['だ:da', 'ぢ:ji', 'づ:zu', 'で:de', 'ど:do']],
  ['ba', ['ば:ba', 'び:bi', 'ぶ:bu', 'べ:be', 'ぼ:bo']],
  ['pa', ['ぱ:pa', 'ぴ:pi', 'ぷ:pu', 'ぺ:pe', 'ぽ:po']]
];
const DAKUTEN_ROWS = new Set(['ga', 'za', 'da', 'ba', 'pa']);
const toKatakana = (ch) => String.fromCodePoint(ch.codePointAt(0) + 0x60);

async function buildKana() {
  const kana = [];
  for (const script of ['hiragana', 'katakana']) {
    for (const [row, items] of ROWS) {
      for (const item of items) {
        const [h, romaji] = item.split(':');
        const char = script === 'hiragana' ? h : toKatakana(h);
        const { strokes } = parseKanjiVG(await cached(`${hex(char)}.svg`, `${KANJIVG}/${hex(char)}.svg`));
        if (!strokes.length) throw new Error(`Không có nét cho ${char}`);
        kana.push({
          id: `${script === 'hiragana' ? 'hira' : 'kata'}:${char}`, char, script, romaji, row,
          kind: DAKUTEN_ROWS.has(row) ? 'dakuten' : 'basic', strokes
        });
      }
    }
  }
  const decks = [
    { id: 'kana-hiragana', title: 'Hiragana', kind: 'kana' },
    { id: 'kana-katakana', title: 'Katakana', kind: 'kana' }
  ];
  const cards = kana.map((k) => ({
    id: `card:${k.id}`, deck: k.script === 'hiragana' ? 'kana-hiragana' : 'kana-katakana', type: 'kana',
    front: k.char, back: k.romaji, ref: { collection: 'kana', id: k.id },
    // Các trường SRS đọc (xem CardContent trong src/features/srs/types.ts)
    word: k.char, reading: k.char, meaning: k.romaji
  }));
  return {
    manifest: {
      format: 1, id: 'kana-core', kind: 'kana', title: 'Hiragana và Katakana', version: 1,
      license: {
        name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/',
        attribution: 'Nét viết kana: KanjiVG © Ulrich Apel và cộng tác viên, CC BY-SA 3.0, https://kanjivg.tagaini.net'
      }
    },
    upserts: { kana, decks, cards }
  };
}

// ---------- Kanji ----------
const RADICAL_NAMES = {
  一: 'Nhất', 丨: 'Cổn', 二: 'Nhị', 人: 'Nhân', 亻: 'Nhân đứng', 儿: 'Nhân chân', 入: 'Nhập', 八: 'Bát', 冂: 'Quynh',
  力: 'Lực', 十: 'Thập', 口: 'Khẩu', 囗: 'Vi', 土: 'Thổ', 夕: 'Tịch', 大: 'Đại', 女: 'Nữ', 子: 'Tử', 宀: 'Miên',
  小: 'Tiểu', 山: 'Sơn', 川: 'Xuyên', 工: 'Công', 干: 'Can', 止: 'Chỉ', 手: 'Thủ', 文: 'Văn', 日: 'Nhật', 月: 'Nguyệt',
  木: 'Mộc', 气: 'Khí', 水: 'Thủy', 火: 'Hỏa', 犬: 'Khuyển', 玉: 'Ngọc', 王: 'Vương', 生: 'Sinh', 田: 'Điền', 白: 'Bạch',
  目: 'Mục', 石: 'Thạch', 穴: 'Huyệt', 立: 'Lập', 竹: 'Trúc', 糸: 'Mịch', 耳: 'Nhĩ', 艹: 'Thảo', 虫: 'Trùng', 見: 'Kiến',
  貝: 'Bối', 赤: 'Xích', 足: 'Túc', 車: 'Xa', 金: 'Kim', 雨: 'Vũ', 青: 'Thanh', 音: 'Âm', 乙: 'Ất', 丿: 'Phiệt'
};

async function buildKanji() {
  const data = JSON.parse(await cached('kanji.json', KANJI_JSON));
  const chars = Object.keys(data).filter((k) => data[k].grade === 1);
  const missing = chars.filter((c) => !CURATED[c]);
  const extra = Object.keys(CURATED).filter((c) => !chars.includes(c));
  if (missing.length || extra.length) throw new Error(`Thiếu nội dung: ${missing.join('')} | thừa: ${extra.join('')}`);

  const kanji = [];
  for (const char of chars) {
    const k = data[char];
    const { strokes, radical } = parseKanjiVG(await cached(`${hex(char)}.svg`, `${KANJIVG}/${hex(char)}.svg`));
    if (strokes.length !== k.strokes) throw new Error(`${char}: KanjiVG ${strokes.length} nét, KANJIDIC ${k.strokes} nét`);
    const [vi, mnemonic, ja, reading, viSentence] = CURATED[char];
    kanji.push({
      id: char, char, grade: k.grade, jlpt: k.jlpt_new ? `N${k.jlpt_new}` : null,
      vi, meaningsEn: k.meanings, onyomi: k.readings_on, kunyomi: k.readings_kun,
      radical: { char: radical ?? char, name: RADICAL_NAMES[radical ?? char] ?? '' },
      mnemonic, examples: [{ ja, reading, vi: viSentence }], strokes
    });
  }
  const cards = kanji.map((k) => ({
    id: `card:kanji:${k.id}`, deck: 'kanji-grade1', type: 'kanji', front: k.char,
    back: `${k.vi} — ${k.onyomi.join('、')} / ${k.kunyomi.join('、')}`, ref: { collection: 'kanji', id: k.id },
    // Các trường SRS đọc: cách đọc ưu tiên Kun (bỏ dấu "." và "-"), không có thì On
    word: k.char, reading: (k.kunyomi[0] ?? k.onyomi[0] ?? '').replace(/[.-]/g, ''), meaning: k.vi,
    example: { ja: k.examples[0].ja, blank: k.char, vi: k.examples[0].vi }
  }));
  return {
    manifest: {
      format: 1, id: 'kanji-grade1', kind: 'kanji', title: 'Kanji lớp 1 (80 chữ)', version: 1,
      license: {
        name: 'CC BY-SA 3.0 / 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        attribution:
          'Cách đọc và nghĩa: KANJIDIC © Electronic Dictionary Research and Development Group (CC BY-SA 4.0), ' +
          'qua bản JSON của David Gouveia. Nét viết: KanjiVG © Ulrich Apel và cộng tác viên (CC BY-SA 3.0). ' +
          'Nghĩa tiếng Việt, truyện gợi nhớ, câu ví dụ: đội Yomineko tự viết.'
      }
    },
    upserts: {
      kanji,
      decks: [{ id: 'kanji-grade1', title: 'Kanji lớp 1', kind: 'kanji' }],
      cards
    }
  };
}

await mkdir(CACHE, { recursive: true });
await mkdir(OUT, { recursive: true });
for (const [file, pack] of [['kana-core', await buildKana()], ['kanji-grade1', await buildKanji()]]) {
  await mkdir(join(OUT, file), { recursive: true });
  const path = join(OUT, file, 'v1.json');
  await writeFile(path, JSON.stringify(pack));
  const n = Object.values(pack.upserts).reduce((s, l) => s + l.length, 0);
  console.log(`${path}: ${n} bản ghi`);
}
