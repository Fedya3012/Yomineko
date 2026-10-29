// Study summaries by day / week / month: totals, strengths, weaknesses and suggestions.
// Everything here is rule-based and offline; AI rewriting lives in rewrite.ts and is optional.
import { addDays, formatDuration } from '../progress/stats';
import type { DayLog, ItemKind, LearnedMap } from '../progress/types';
import type { DayStats } from '../srs/types';
import { CATEGORY_LABEL, CATEGORY_TIP, analyzeWeakness, isRepeatedMistake, type WeakEntry } from './weakness';

export type Period = 'day' | 'week' | 'month';
export const PERIOD_LABEL: Record<Period, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' };

export interface PeriodRange { from: string; to: string; title: string }

const parts = (key: string) => key.split('-').map(Number) as [number, number, number];
const pad = (n: number) => String(n).padStart(2, '0');

/** Week = Monday..Sunday; month = calendar month. `anchor` is any local date "YYYY-MM-DD" inside the period. */
export function periodRange(period: Period, anchor: string): PeriodRange {
  if (period === 'day') return { from: anchor, to: anchor, title: `Ngày ${anchor}` };
  if (period === 'week') {
    const dow = (new Date(`${anchor}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
    const from = addDays(anchor, -dow);
    const to = addDays(from, 6);
    return { from, to, title: `Tuần ${from} → ${to}` };
  }
  const [y, m] = parts(anchor);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}`, title: `Tháng ${m}/${y}` };
}

/** Moves the anchor one period back (-1) or forward (+1). */
export function shiftAnchor(period: Period, anchor: string, dir: -1 | 1): string {
  if (period === 'day') return addDays(anchor, dir);
  if (period === 'week') return addDays(anchor, 7 * dir);
  const [y, m] = parts(anchor);
  const d = new Date(Date.UTC(y, m - 1 + dir, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

export interface ItemStat { kind: ItemKind; id: string; label: string; seen: number; missed: number }
export interface StudySummary {
  period: Period; range: PeriodRange;
  activeDays: number; sessions: number; seconds: number; cards: number; correct: number; accuracy: number;
  touched: Record<ItemKind, number>;
  newlyLearned: Record<ItemKind, number>;
  srs: { reviewed: number; newCards: number; again: number; hard: number; good: number; easy: number; remembered: number };
  keyContent: ItemStat[];
  strengths: string[];
  weaknesses: { label: string; detail: string }[];
  suggestions: string[];
}

export interface SummaryInput {
  logs: Map<string, DayLog>; learned: LearnedMap; srs: Map<string, DayStats>;
  period: Period; anchor: string; goalMinutes?: number;
}

const inRange = (d: string, r: PeriodRange) => d >= r.from && d <= r.to;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const KIND_VI: Record<ItemKind, string> = { word: 'từ vựng', kanji: 'kanji', grammar: 'ngữ pháp' };

export function buildStudySummary({ logs, learned, srs, period, anchor }: SummaryInput): StudySummary {
  const range = periodRange(period, anchor);
  const items = new Map<string, ItemStat>();
  let activeDays = 0, sessions = 0, seconds = 0, cards = 0, missed = 0;
  const periodLogs = new Map<string, DayLog>();
  for (const [d, log] of logs) {
    if (!inRange(d, range)) continue;
    periodLogs.set(d, log);
    if (log.cards > 0 || log.seconds > 0) activeDays++;
    sessions += log.sessions; seconds += log.seconds; cards += log.cards;
    for (const [key, it] of Object.entries(log.items)) {
      const s = items.get(key) ?? { kind: it.kind, id: it.id, label: it.label, seen: 0, missed: 0 };
      s.seen += it.seen; s.missed += it.missed; s.label = it.label;
      items.set(key, s);
      missed += it.missed;
    }
  }
  const correct = cards - missed;
  const touched: Record<ItemKind, number> = { word: 0, kanji: 0, grammar: 0 };
  for (const s of items.values()) touched[s.kind]++;
  const newlyLearned: Record<ItemKind, number> = { word: 0, kanji: 0, grammar: 0 };
  for (const k of Object.keys(newlyLearned) as ItemKind[]) {
    for (const date of Object.values(learned[k] ?? {})) if (inRange(date, range)) newlyLearned[k]++;
  }
  const s = { reviewed: 0, newCards: 0, again: 0, hard: 0, good: 0, easy: 0, remembered: 0 };
  for (const [d, st] of srs) {
    if (!inRange(d, range)) continue;
    s.reviewed += st.reviewed; s.newCards += st.newCards; s.again += st.again; s.hard += st.hard; s.good += st.good; s.easy += st.easy;
  }
  s.remembered = s.hard + s.good + s.easy;

  const keyContent = [...items.values()].sort((a, b) => b.seen - a.seen || b.missed - a.missed).slice(0, 5);
  const report = analyzeWeakness(periodLogs, range.to, 366);
  const weakItems = report.items.filter(isRepeatedMistake);
  const weaknesses: StudySummary['weaknesses'] = [
    ...report.categories.slice(0, 3).filter((c) => c.errorRate >= 0.25).map((c) => ({ label: c.label, detail: `sai ${c.missed}/${c.seen} lượt (${pct(c.errorRate)})` })),
    ...weakItems.slice(0, 3).map((w: WeakEntry) => ({ label: w.label, detail: `sai ${w.missed}/${w.seen} lượt` }))
  ];
  const accuracy = cards ? correct / cards : 0;
  const strengths = [...items.values()].filter((i) => i.seen >= 3 && i.missed === 0).sort((a, b) => b.seen - a.seen).slice(0, 3).map((i) => `${i.label} (đúng ${i.seen}/${i.seen})`);
  if (cards >= 10 && accuracy >= 0.85) strengths.unshift(`Độ chính xác chung cao: ${pct(accuracy)}`);
  if (activeDays >= (period === 'day' ? 1 : period === 'week' ? 5 : 20)) strengths.unshift(`Học đều đặn: ${activeDays} ngày có học`);

  const suggestions = buildSuggestions({ period, activeDays, cards, accuracy, seconds, report, weaknessCount: weakItems.length });
  return { period, range, activeDays, sessions, seconds, cards, correct, accuracy, touched, newlyLearned, srs: s, keyContent, strengths, weaknesses, suggestions };
}

function buildSuggestions(i: { period: Period; activeDays: number; cards: number; accuracy: number; seconds: number; report: ReturnType<typeof analyzeWeakness>; weaknessCount: number }): string[] {
  if (i.cards === 0 && i.seconds === 0) return ['Chưa có dữ liệu trong khoảng này. Thử một buổi ôn ngắn 5 phút để bắt đầu.'];
  const out: string[] = [];
  const top = i.report.categories[0];
  if (top && top.errorRate >= 0.25) out.push(`Buổi sau ưu tiên: ${CATEGORY_LABEL[top.category]}. ${CATEGORY_TIP[top.category]}`);
  if (i.weaknessCount > 0) out.push(`Có ${i.weaknessCount} mục sai lặp lại; chúng sẽ được hỏi trước trong lần ôn tập tới.`);
  if (i.accuracy < 0.7) out.push('Độ chính xác dưới 70%: giảm số thẻ mới, dành thêm thời gian ôn lại thẻ cũ.');
  else if (i.accuracy >= 0.92) out.push('Độ chính xác trên 92%: có thể tăng số thẻ mới hoặc thử bài khó hơn.');
  const wantDays = i.period === 'month' ? 20 : 5;
  if (i.period !== 'day' && i.activeDays < wantDays) out.push(`Mới học ${i.activeDays} ngày; thử học ít nhưng đều (5 phút mỗi ngày) để nhớ lâu hơn.`);
  if (out.length === 0) out.push('Đang đi đúng hướng. Giữ nhịp này và thêm một ít nội dung mới.');
  return out;
}

export function summaryToText(s: StudySummary): string {
  const L = [s.range.title, `Thời gian học: ${formatDuration(s.seconds)} · ${s.sessions} buổi · ${s.activeDays} ngày có học`,
    `Số lượt trả lời: ${s.cards} · đúng ${pct(s.accuracy)}`,
    `Đã chạm tới: ${(Object.keys(KIND_VI) as ItemKind[]).map((k) => `${s.touched[k]} ${KIND_VI[k]}`).join(', ')}`];
  const nl = (Object.keys(KIND_VI) as ItemKind[]).filter((k) => s.newlyLearned[k] > 0).map((k) => `${s.newlyLearned[k]} ${KIND_VI[k]}`);
  if (nl.length) L.push(`Mới thuộc: ${nl.join(', ')}`);
  if (s.srs.reviewed) L.push(`Ôn SRS: ${s.srs.reviewed} thẻ (${s.srs.newCards} mới) · nhớ ${pct(s.srs.remembered / s.srs.reviewed)} · quên ${s.srs.again}`);
  if (s.keyContent.length) L.push(`Nội dung chính: ${s.keyContent.map((k) => k.label).join(', ')}`);
  if (s.strengths.length) L.push(`Điểm mạnh: ${s.strengths.join('; ')}`);
  if (s.weaknesses.length) L.push(`Điểm yếu: ${s.weaknesses.map((w) => `${w.label} - ${w.detail}`).join('; ')}`);
  L.push(`Gợi ý buổi sau:`, ...s.suggestions.map((x) => `- ${x}`));
  return L.join('\n');
}

export function summaryToMarkdown(s: StudySummary): string {
  const out = [`# ${s.range.title}`, '', '## Tổng quan',
    `- **Thời gian học:** ${formatDuration(s.seconds)} (${s.sessions} buổi, ${s.activeDays} ngày có học)`,
    `- **Lượt trả lời:** ${s.cards}, đúng ${pct(s.accuracy)}`,
    ...(Object.keys(KIND_VI) as ItemKind[]).map((k) => `- **${KIND_VI[k][0].toUpperCase() + KIND_VI[k].slice(1)}:** chạm ${s.touched[k]}, mới thuộc ${s.newlyLearned[k]}`)];
  if (s.srs.reviewed) out.push('', '## Kết quả SRS', `- Ôn ${s.srs.reviewed} thẻ (${s.srs.newCards} thẻ mới)`, `- Quên ${s.srs.again} · Khó ${s.srs.hard} · Tốt ${s.srs.good} · Dễ ${s.srs.easy}`, `- Tỉ lệ nhớ: ${pct(s.srs.remembered / s.srs.reviewed)}`);
  if (s.keyContent.length) out.push('', '## Nội dung chính', ...s.keyContent.map((k) => `- ${k.label} — ${k.seen} lượt, sai ${k.missed}`));
  out.push('', '## Điểm mạnh', ...(s.strengths.length ? s.strengths.map((x) => `- ${x}`) : ['- (chưa đủ dữ liệu)']));
  out.push('', '## Điểm yếu', ...(s.weaknesses.length ? s.weaknesses.map((w) => `- ${w.label} — ${w.detail}`) : ['- Chưa thấy điểm yếu rõ rệt']));
  out.push('', '## Gợi ý cho buổi sau', ...s.suggestions.map((x) => `- ${x}`));
  return out.join('\n') + '\n';
}

export const summaryFileName = (s: StudySummary) => `yomineko-tong-ket-${s.period}-${s.range.from}.md`;
