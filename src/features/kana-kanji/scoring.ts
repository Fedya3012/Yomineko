// Chấm nét viết tay. Mọi toạ độ ở hệ 109x109 của KanjiVG.
// Ý tưởng: lấy mẫu lại nét của người học và nét chuẩn thành cùng số điểm theo chiều dài,
// rồi đo khoảng cách trung bình giữa các điểm tương ứng. Nét viết ngược chiều bị phát hiện riêng.
import type { Point } from './types';
import { pathToPoints } from './path';

export const CANVAS = 109;
export const PASS_SCORE = 60;
const SAMPLES = 32;

export function strokeLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
}

/** Lấy lại n điểm cách đều nhau dọc theo chiều dài nét. */
export function resample(pts: Point[], n = SAMPLES): Point[] {
  if (pts.length === 0) return [];
  const total = strokeLength(pts);
  if (total === 0) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out: Point[] = [{ ...pts[0] }];
  const step = total / (n - 1);
  let acc = 0, i = 1, prev = pts[0];
  while (out.length < n - 1 && i < pts.length) {
    const seg = Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y);
    if (acc + seg >= step && seg > 0) {
      const t = (step - acc) / seg;
      const p = { x: prev.x + (pts[i].x - prev.x) * t, y: prev.y + (pts[i].y - prev.y) * t };
      out.push(p); prev = p; acc = 0;
    } else { acc += seg; prev = pts[i]; i++; }
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out;
}

const meanDist = (a: Point[], b: Point[]) =>
  a.reduce((s, p, i) => s + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / a.length;

export type Reason = 'ok' | 'too-short' | 'wrong-direction' | 'wrong-shape';

export interface StrokeScore { score: number; pass: boolean; reason: Reason }

/** Khoảng cách trung bình chấp nhận được (~24% cạnh khung) để vẫn còn điểm; tay vẽ trên màn hình cảm ứng nên khá rộng rãi. */
const TOLERANCE = CANVAS * 0.24;

/** Chấm một nét người học (`user`) so với nét chuẩn (`ref`, dạng đường nét SVG). */
export function scoreStroke(user: Point[], ref: string | Point[]): StrokeScore {
  const refPts = typeof ref === 'string' ? pathToPoints(ref) : ref;
  const refLen = strokeLength(refPts);
  const userLen = strokeLength(user);
  if (user.length < 2 && refLen > 6) return { score: 0, pass: false, reason: 'too-short' };

  const r = resample(refPts), u = resample(user);
  const forward = meanDist(u, r);
  const backward = meanDist([...u].reverse(), r);
  const toScore = (d: number) => Math.max(0, Math.round(100 * (1 - d / TOLERANCE)));

  // Nét rất ngắn (chấm, phẩy): chỉ cần gần đúng vị trí.
  if (refLen <= 12) {
    const near = meanDist([u[Math.floor(u.length / 2)]], [r[Math.floor(r.length / 2)]]);
    const score = toScore(near);
    return { score, pass: score >= PASS_SCORE, reason: score >= PASS_SCORE ? 'ok' : 'wrong-shape' };
  }

  if (userLen < refLen * 0.4) return { score: Math.min(toScore(forward), 40), pass: false, reason: 'too-short' };

  const score = toScore(forward);
  if (score < PASS_SCORE && toScore(backward) >= PASS_SCORE) return { score: Math.min(score, 45), pass: false, reason: 'wrong-direction' };
  return { score, pass: score >= PASS_SCORE, reason: score >= PASS_SCORE ? 'ok' : 'wrong-shape' };
}

export interface Judgement extends StrokeScore {
  /** Nét tiếp theo đúng thứ tự, hoặc nét khác mà người học vừa viết nhầm chỗ. */
  expected: number;
  /** Nếu viết đúng hình nhưng sai thứ tự: chỉ số nét mà họ thực sự đã viết. */
  matchedIndex?: number;
}

/** Chấm nét thứ `expected`; nếu sai, kiểm tra xem có phải sai thứ tự (khớp với nét chưa viết khác) không. */
export function judgeStroke(user: Point[], refs: string[], expected: number, done: ReadonlySet<number> = new Set()): Judgement {
  const main = scoreStroke(user, refs[expected]);
  if (main.pass) return { ...main, expected };
  let best: { i: number; s: StrokeScore } | null = null;
  refs.forEach((ref, i) => {
    if (i === expected || done.has(i)) return;
    const s = scoreStroke(user, ref);
    if (s.pass && (!best || s.score > best.s.score)) best = { i, s };
  });
  if (best) return { score: Math.min(main.score, 50), pass: false, reason: 'wrong-shape', expected, matchedIndex: (best as { i: number }).i };
  return { ...main, expected };
}

/** Điểm tổng cho cả chữ và số sao (0–3). Mỗi lần viết sai một nét bị trừ nhẹ. */
export function summarize(strokeScores: number[], mistakes: number): { score: number; stars: 0 | 1 | 2 | 3 } {
  if (strokeScores.length === 0) return { score: 0, stars: 0 };
  const avg = strokeScores.reduce((s, x) => s + x, 0) / strokeScores.length;
  const score = Math.max(0, Math.round(avg - mistakes * 4));
  const stars = score >= 85 ? 3 : score >= 70 ? 2 : score >= PASS_SCORE ? 1 : 0;
  return { score, stars };
}
