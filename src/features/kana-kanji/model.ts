// Nạp nội dung kana/kanji từ kho offline, và lưu tiến độ học của người dùng.
// Nội dung nằm trong `records` (qua gói); tiến độ nằm trong `userdata` (không bao giờ bị cập nhật gói đụng tới).
import { getUserData, listCollection, setUserData, type DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import type { Card, Kana, Kanji, Script } from './types';

export const PACK_IDS = ['kana-core', 'kanji-grade1'] as const;

/** Cài hai gói đi kèm app nếu máy chưa có (hoặc đang cũ hơn). Các bản mới hơn tải từ catalog sau này. */
export async function ensureContentInstalled(db: DB): Promise<void> {
  const bundled: Record<string, () => Promise<{ default: unknown }>> = {
    'kana-core': () => import('../../../packs-example/kana-core.pack.json'),
    'kanji-grade1': () => import('../../../packs-example/kanji-grade1.pack.json')
  };
  for (const id of PACK_IDS) {
    if (await db.get('packs', id)) continue;
    await installPack(db, (await bundled[id]()).default);
  }
}

const KANA_ORDER = ['a', 'ka', 'sa', 'ta', 'na', 'ha', 'ma', 'ya', 'ra', 'wa', 'ga', 'za', 'da', 'ba', 'pa'];

export async function loadKana(db: DB, script?: Script): Promise<Kana[]> {
  const all = (await listCollection(db, 'kana')) as unknown as Kana[];
  return all
    .filter((k) => !script || k.script === script)
    .sort((a, b) => KANA_ORDER.indexOf(a.row) - KANA_ORDER.indexOf(b.row) || a.id.localeCompare(b.id, 'ja'));
}

export async function loadKanji(db: DB): Promise<Kanji[]> {
  return (await listCollection(db, 'kanji')) as unknown as Kanji[];
}

export interface RadicalGroup { radical: Kanji['radical']; kanji: Kanji[] }

/** Gom kanji theo bộ thủ; nhóm đông nhất lên trước, trong nhóm xếp theo số nét. */
export function groupByRadical(list: readonly Kanji[]): RadicalGroup[] {
  const map = new Map<string, RadicalGroup>();
  for (const k of list) {
    const g = map.get(k.radical.char) ?? { radical: k.radical, kanji: [] };
    g.kanji.push(k);
    map.set(k.radical.char, g);
  }
  const groups = [...map.values()];
  for (const g of groups) g.kanji.sort((a, b) => a.strokes.length - b.strokes.length || a.char.localeCompare(b.char, 'ja'));
  return groups.sort((a, b) => b.kanji.length - a.kanji.length || a.radical.char.localeCompare(b.radical.char, 'ja'));
}

/** Cách đọc Kun: "ひと.つ" -> "ひと(つ)", "-び" -> "〜び". */
export function formatKun(reading: string): string {
  const [stem, tail] = reading.split('.');
  const s = stem.replace(/^-/, '〜').replace(/-$/, '〜');
  return tail ? `${s}(${tail})` : s;
}

// ---------- Tiến độ của người học (userdata) ----------
export const KNOWN_KEY = 'kanji.known';          // thread Kana/Kanji sở hữu; SRS chỉ đọc
export const KANA_KNOWN_KEY = 'kana.known';
export const PRACTICE_KEY = 'kanji.practice';    // { [id]: { best: điểm 0-100, stars, tries } }

export interface PracticeRecord { best: number; stars: number; tries: number }

export async function getKnown(db: DB, key: string = KNOWN_KEY): Promise<Set<string>> {
  return new Set((await getUserData<string[]>(db, key)) ?? []);
}

export async function setKnown(db: DB, id: string, known: boolean, key: string = KNOWN_KEY): Promise<Set<string>> {
  const set = await getKnown(db, key);
  if (known) set.add(id); else set.delete(id);
  await setUserData(db, key, [...set]);
  return set;
}

export async function getPractice(db: DB): Promise<Record<string, PracticeRecord>> {
  return (await getUserData<Record<string, PracticeRecord>>(db, PRACTICE_KEY)) ?? {};
}

/** Ghi kết quả luyện viết. Đạt từ 1 sao trở lên thì tự đánh dấu đã biết nét viết chữ đó. */
export async function recordPractice(db: DB, id: string, score: number, stars: number): Promise<PracticeRecord> {
  const all = await getPractice(db);
  const prev = all[id];
  const rec: PracticeRecord = { best: Math.max(prev?.best ?? 0, score), stars: Math.max(prev?.stars ?? 0, stars), tries: (prev?.tries ?? 0) + 1 };
  await setUserData(db, PRACTICE_KEY, { ...all, [id]: rec });
  return rec;
}

/**
 * Cầu nối sang SRS: các thẻ (collection "cards") của những chữ người học đã đánh dấu "đã học".
 * Thread SRS dùng danh sách này để biết thẻ nào cần đưa vào lịch ôn.
 */
export async function getIntroducedCards(db: DB): Promise<Card[]> {
  const [cards, kanji, kana] = await Promise.all([
    listCollection(db, 'cards') as unknown as Promise<Card[]>,
    getKnown(db, KNOWN_KEY),
    getKnown(db, KANA_KNOWN_KEY)
  ]);
  return cards.filter((c) => (c.ref.collection === 'kanji' ? kanji : kana).has(c.ref.id));
}
