// Adaptive difficulty: looks at recent results and proposes new SRS settings. Pure rule-based, works offline.
import { addDays } from '../progress/stats';
import type { DayLog } from '../progress/types';
import type { DayStats, SrsSettings } from '../srs/types';

export type Difficulty = 'easier' | 'keep' | 'harder';
export interface Recommendation {
  level: Difficulty; reason: string; sampleCards: number; accuracy: number;
  newPerDay: number; retention: number; changed: boolean;
}

export const MIN_SAMPLE = 20;
export const BOUNDS = { newPerDay: [3, 30], retention: [0.8, 0.95] } as const;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

/** Uses the last `days` days. `srs` (per-day Again/Hard/Good/Easy counts) is optional; accuracy falls back to the progress logs. */
export function recommendDifficulty(logs: Map<string, DayLog>, srs: Map<string, DayStats>, settings: SrsSettings, today: string, days = 7): Recommendation {
  const from = addDays(today, -(days - 1));
  let cards = 0, missed = 0, again = 0, reviewed = 0;
  for (const [d, log] of logs) {
    if (d < from || d > today) continue;
    for (const it of Object.values(log.items)) { cards += it.seen; missed += it.missed; }
  }
  for (const [d, s] of srs) {
    if (d < from || d > today) continue;
    reviewed += s.reviewed; again += s.again;
  }
  const accuracy = cards ? 1 - missed / cards : 0;
  const keep = (reason: string): Recommendation => ({ level: 'keep', reason, sampleCards: cards, accuracy, newPerDay: settings.newPerDay, retention: settings.retention, changed: false });
  if (cards < MIN_SAMPLE) return keep(`Mới có ${cards} lượt trả lời trong ${days} ngày qua, cần ít nhất ${MIN_SAMPLE} để đánh giá. Giữ nguyên độ khó.`);

  const againRate = reviewed ? again / reviewed : missed / cards;
  const pct = Math.round(accuracy * 100);
  let level: Difficulty = 'keep';
  if (accuracy >= 0.92 && againRate <= 0.08) level = 'harder';
  else if (accuracy < 0.7 || againRate >= 0.3) level = 'easier';
  if (level === 'keep') return keep(`Đúng ${pct}% trong ${days} ngày qua, mức vừa sức. Giữ nguyên.`);

  const newPerDay = clamp(settings.newPerDay + (level === 'harder' ? 2 : -3), BOUNDS.newPerDay);
  const retention = clamp(Math.round((settings.retention + (level === 'easier' ? 0.02 : 0)) * 100) / 100, BOUNDS.retention);
  const changed = newPerDay !== settings.newPerDay || retention !== settings.retention;
  const reason = level === 'harder'
    ? `Đúng ${pct}% trong ${days} ngày qua, hơi dễ. Tăng số thẻ mới lên ${newPerDay}/ngày.`
    : `Đúng ${pct}% trong ${days} ngày qua, hơi khó. Giảm thẻ mới còn ${newPerDay}/ngày và ôn thường xuyên hơn (mức nhớ ${Math.round(retention * 100)}%).`;
  return { level, reason, sampleCards: cards, accuracy, newPerDay, retention, changed };
}

export const applyRecommendation = (s: SrsSettings, r: Recommendation): SrsSettings => ({ ...s, newPerDay: r.newPerDay, retention: r.retention });
