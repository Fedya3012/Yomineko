// Finds the mistakes the learner repeats, using only the per-day logs the Progress feature already keeps.
// Pure functions: no database, no network.
import { addDays } from '../progress/stats';
import type { DayItem, DayLog, ItemKind } from '../progress/types';

export type WeakCategory = 'particle' | 'conjugation' | 'reading-on' | 'reading-kun' | 'kanji' | 'vocab' | 'grammar';

export const CATEGORY_LABEL: Record<WeakCategory, string> = {
  particle: 'Trợ từ (は, が, を, に, で...)',
  conjugation: 'Chia động từ / tính từ',
  'reading-on': 'Âm đọc On (音読み)',
  'reading-kun': 'Âm đọc Kun (訓読み)',
  kanji: 'Kanji khác',
  vocab: 'Từ vựng',
  grammar: 'Ngữ pháp khác'
};
const CATEGORIES = Object.keys(CATEGORY_LABEL) as WeakCategory[];

const PARTICLES = ['は', 'が', 'を', 'に', 'で', 'へ', 'と', 'も', 'の', 'から', 'まで', 'より', 'や', 'か', 'ね', 'よ'];
const PARTICLE_IDS = new Set(['wa', 'ga', 'wo', 'o', 'ni', 'de', 'e', 'to', 'mo', 'no', 'kara', 'made', 'yori', 'ya', 'ka', 'ne', 'yo']);
const CONJ_HINT = /(て形|た形|ない形|ます形|辞書形|活用|conjug|chia động từ|chia thể|thể\s*(て|た|ない|ます|te|ta|nai|masu)|te-form|nai-form|masu-form)/i;

export interface Classifiable { kind: ItemKind; id: string; label: string; tag?: string }

/** An explicit `tag` from the feature that asked the question wins; otherwise guess from the label. */
export function classifyItem(it: Classifiable): WeakCategory {
  if (it.tag && (CATEGORIES as string[]).includes(it.tag)) return it.tag as WeakCategory;
  if (CONJ_HINT.test(it.label) || CONJ_HINT.test(it.id)) return 'conjugation';
  if (it.kind === 'kanji') {
    if (/音読み|on[-\s]?yomi|âm on|\bon\b/i.test(it.label)) return 'reading-on';
    if (/訓読み|kun[-\s]?yomi|âm kun|\bkun\b/i.test(it.label)) return 'reading-kun';
    return 'kanji';
  }
  if (it.kind === 'grammar') {
    const head = it.label.trim();
    if (PARTICLE_IDS.has(it.id.toLowerCase()) || PARTICLES.some((p) => head === p || head.startsWith(`${p} `) || head.startsWith(`${p}(`) || head.startsWith(`${p}（`))) return 'particle';
    return 'grammar';
  }
  return 'vocab';
}

export interface WeakEntry {
  key: string; kind: ItemKind; id: string; label: string; category: WeakCategory;
  seen: number; missed: number; /** 0..1 */ errorRate: number; /** higher = review sooner */ score: number;
}
export interface CategoryStat { category: WeakCategory; label: string; seen: number; missed: number; errorRate: number; score: number }
export interface WeaknessReport { from: string; to: string; items: WeakEntry[]; categories: CategoryStat[] }

/** Recent mistakes count more: a miss halves in weight every `HALF_LIFE` days. */
export const HALF_LIFE = 7;

export function analyzeWeakness(logs: Map<string, DayLog>, today: string, days = 30): WeaknessReport {
  const from = addDays(today, -(days - 1));
  const acc = new Map<string, WeakEntry>();
  for (const [date, log] of logs) {
    if (date < from || date > today) continue;
    const age = (Date.parse(today) - Date.parse(date)) / 86_400_000;
    const w = Math.pow(0.5, age / HALF_LIFE);
    for (const [key, it] of Object.entries(log.items) as [string, DayItem][]) {
      const e = acc.get(key) ?? { key, kind: it.kind, id: it.id, label: it.label, category: classifyItem(it), seen: 0, missed: 0, errorRate: 0, score: 0 };
      e.label = it.label;
      e.category = classifyItem({ ...it, tag: it.tag ?? undefined });
      e.seen += it.seen;
      e.missed += it.missed;
      e.score += it.missed * w;
      acc.set(key, e);
    }
  }
  const items = [...acc.values()].filter((e) => e.missed > 0).map((e) => {
    const errorRate = e.seen ? e.missed / e.seen : 0;
    return { ...e, errorRate, score: e.score * (0.5 + errorRate) };
  }).sort((a, b) => b.score - a.score || b.missed - a.missed);

  const cats = new Map<WeakCategory, CategoryStat>();
  for (const e of acc.values()) {
    const c = cats.get(e.category) ?? { category: e.category, label: CATEGORY_LABEL[e.category], seen: 0, missed: 0, errorRate: 0, score: 0 };
    c.seen += e.seen; c.missed += e.missed;
    cats.set(e.category, c);
  }
  for (const it of items) cats.get(it.category)!.score += it.score;
  const categories = [...cats.values()].map((c) => ({ ...c, errorRate: c.seen ? c.missed / c.seen : 0 }))
    .filter((c) => c.missed > 0).sort((a, b) => b.score - a.score);
  return { from, to: today, items, categories };
}

/** "Often" = missed at least twice and wrong at least a third of the time, so one slip does not label an item weak. */
export const isRepeatedMistake = (e: WeakEntry) => e.missed >= 2 && e.errorRate >= 1 / 3;

/** cardId -> score, for the SRS queue. SRS reports words with `id = cardId`. */
export function reviewBoost(report: WeaknessReport): Map<string, number> {
  return new Map(report.items.filter((e) => e.kind === 'word' && isRepeatedMistake(e)).map((e) => [e.id, e.score]));
}

/** A short Vietnamese tip per category, used when the AI is off. */
export const CATEGORY_TIP: Record<WeakCategory, string> = {
  particle: 'Đặt 5 câu ngắn cho mỗi trợ từ hay sai, đọc to và so sánh は với が.',
  conjugation: 'Ôn từng nhóm động từ (nhóm 1, 2, 3) riêng, chia bằng miệng rồi mới viết.',
  'reading-on': 'Học âm On theo cụm từ ghép (熟語) thay vì đọc rời từng chữ.',
  'reading-kun': 'Gắn âm Kun với okurigana, ví dụ 食べる, 食べ物.',
  kanji: 'Viết lại các kanji hay sai 3 lần và tạo một câu ví dụ cho mỗi chữ.',
  vocab: 'Ôn các từ hay sai trước, mỗi từ kèm một câu ví dụ.',
  grammar: 'Đọc lại mẫu câu và tự đặt 2 câu mới với mỗi mẫu.'
};
