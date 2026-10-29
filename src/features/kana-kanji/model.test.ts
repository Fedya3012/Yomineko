import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, listCollection, type DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import { pathToPoints } from './path';
import {
  ensureContentInstalled, formatKun, getIntroducedCards, getPractice, groupByRadical, loadKana, loadKanji, recordPractice, setKnown,
  KANA_KNOWN_KEY
} from './model';
import { scoreStroke } from './scoring';
import kanaPack from '../../../packs-src/kana-core/v1.json';
import kanjiPack from '../../../packs-src/kanji-grade1/v1.json';

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`kk-${n++}`); });

describe('gói nội dung đi kèm', () => {
  it('hợp lệ và cài được vào kho offline', async () => {
    await ensureContentInstalled(db);
    expect((await loadKana(db, 'hiragana')).length).toBe(71);
    expect((await loadKana(db, 'katakana')).length).toBe(71);
    expect((await loadKanji(db)).length).toBe(80);
  });
  it('cài lần hai không lỗi và không nhân đôi dữ liệu', async () => {
    await ensureContentInstalled(db);
    await ensureContentInstalled(db);
    expect((await loadKanji(db)).length).toBe(80);
  });
  it('ghi rõ giấy phép và ghi công (KanjiVG, KANJIDIC)', () => {
    expect(kanaPack.manifest.license.attribution).toMatch(/KanjiVG/);
    expect(kanjiPack.manifest.license.attribution).toMatch(/KANJIDIC/);
  });
  it('mỗi chữ có đủ nội dung để học', async () => {
    await ensureContentInstalled(db);
    for (const k of await loadKanji(db)) {
      expect(k.vi, k.char).toBeTruthy();
      expect(k.mnemonic.length, k.char).toBeGreaterThan(10);
      expect(k.examples.length, k.char).toBeGreaterThan(0);
      expect(k.examples[0].ja, k.char).toContain(k.char);
      expect(k.onyomi.length + k.kunyomi.length, k.char).toBeGreaterThan(0);
      expect(k.strokes.length, k.char).toBeGreaterThan(0);
      expect(k.radical.char, k.char).toBeTruthy();
    }
  });
  it('mọi nét chuẩn đều đọc được và tự chấm đạt điểm tối đa', async () => {
    await ensureContentInstalled(db);
    for (const item of [...(await loadKana(db)), ...(await loadKanji(db))]) {
      for (const d of item.strokes) {
        const s = scoreStroke(pathToPoints(d), d);
        expect(s.pass, `${item.id} ${d}`).toBe(true);
        expect(s.score).toBeGreaterThanOrEqual(95);
      }
    }
  });
  it('thẻ SRS trỏ đúng tới chữ có thật', async () => {
    await ensureContentInstalled(db);
    const cards = (await listCollection(db, 'cards')) as { id: string; ref: { collection: string; id: string }; deck: string }[];
    const decks = new Set(((await listCollection(db, 'decks')) as { id: string }[]).map((d) => d.id));
    expect(cards.length).toBe(142 + 80);
    for (const c of cards as unknown as { word: string; reading: string; meaning: string; example?: { ja: string; blank: string } }[]) {
      expect(c.word && c.reading && c.meaning).toBeTruthy();
      if (c.example) expect(c.example.ja).toContain(c.example.blank);
    }
    for (const c of cards) {
      expect(decks.has(c.deck)).toBe(true);
      expect(await db.get('records', [c.ref.collection, c.ref.id])).toBeTruthy();
    }
  });
});

describe('groupByRadical', () => {
  it('gom đúng bộ và xếp nhóm đông lên trước', async () => {
    await ensureContentInstalled(db);
    const groups = groupByRadical(await loadKanji(db));
    expect(groups.reduce((s, g) => s + g.kanji.length, 0)).toBe(80);
    const wood = groups.find((g) => g.radical.char === '木')!;
    expect(wood.kanji.map((k) => k.char).sort()).toEqual(['森', '本', '村', '林', '校', '木'].sort());
    expect(groups[0].kanji.length).toBeGreaterThanOrEqual(groups.at(-1)!.kanji.length);
  });
});

describe('formatKun', () => {
  it('hiển thị okurigana trong ngoặc', () => {
    expect(formatKun('ひと.つ')).toBe('ひと(つ)');
    expect(formatKun('-び')).toBe('〜び');
    expect(formatKun('ひと-')).toBe('ひと〜');
    expect(formatKun('ひ')).toBe('ひ');
  });
});

describe('tiến độ người học', () => {
  it('lưu điểm cao nhất và số lần thử, độc lập với nội dung gói', async () => {
    await recordPractice(db, '日', 70, 2);
    const rec = await recordPractice(db, '日', 55, 0);
    expect(rec).toEqual({ best: 70, stars: 2, tries: 2 });
    await installPack(db, { ...kanjiPack, manifest: { ...kanjiPack.manifest, version: 2 } });
    expect((await getPractice(db))['日']).toEqual(rec);
  });
  it('thẻ đưa sang SRS chỉ gồm chữ đã đánh dấu "đã học"', async () => {
    await ensureContentInstalled(db);
    expect(await getIntroducedCards(db)).toEqual([]);
    await setKnown(db, '日', true);
    await setKnown(db, 'hira:あ', true, KANA_KNOWN_KEY);
    const ids = (await getIntroducedCards(db)).map((c) => c.id).sort();
    expect(ids).toEqual(['card:hira:あ', 'card:kanji:日']);
    await setKnown(db, '日', false);
    expect((await getIntroducedCards(db)).map((c) => c.id)).toEqual(['card:hira:あ']);
  });
});
