import { describe, it, expect } from 'vitest';
import { pathToPoints } from './path';
import { judgeStroke, resample, scoreStroke, strokeLength, summarize } from './scoring';
import type { Point } from './types';

const HORIZONTAL = 'M10,50 L90,50';
const line = (x1: number, y1: number, x2: number, y2: number, n = 20): Point[] =>
  Array.from({ length: n }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / (n - 1), y: y1 + ((y2 - y1) * i) / (n - 1) }));
const wobble = (pts: Point[], amount: number) => pts.map((p, i) => ({ x: p.x, y: p.y + (i % 2 ? amount : -amount) }));

describe('pathToPoints', () => {
  it('đọc lệnh tuyệt đối và tương đối', () => {
    const pts = pathToPoints('M10,10 l20,0 v20 H10 z');
    expect(pts.slice(0, 4)).toEqual([{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 30 }, { x: 10, y: 30 }]);
    expect(pts.at(-1)).toEqual({ x: 10, y: 10 });
  });
  it('đường cong bậc ba kết thúc đúng điểm cuối và đi qua nhiều điểm', () => {
    const pts = pathToPoints('M0,0c10,0,20,10,20,20');
    expect(pts.length).toBeGreaterThan(5);
    expect(pts.at(-1)!.x).toBeCloseTo(20); expect(pts.at(-1)!.y).toBeCloseTo(20);
  });
  it('lệnh s phản chiếu điểm điều khiển trước đó', () => {
    const a = pathToPoints('M0,0 c5,0,10,5,10,10 s5,10,10,10');
    expect(a.at(-1)).toEqual({ x: 20, y: 20 });
  });
  it('báo lỗi rõ khi gặp lệnh lạ', () => {
    expect(() => pathToPoints('M0,0 A5,5 0 0 1 10,10')).toThrow(/chưa hỗ trợ/);
  });
});

describe('resample', () => {
  it('cho ra đúng số điểm, cách đều nhau, giữ nguyên đầu và cuối', () => {
    const r = resample(line(0, 0, 100, 0, 5), 11);
    expect(r).toHaveLength(11);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[5].x).toBeCloseTo(50);
    expect(r[10].x).toBeCloseTo(100);
  });
  it('điểm đơn lẻ vẫn không làm hỏng', () => {
    expect(resample([{ x: 5, y: 5 }], 4)).toHaveLength(4);
  });
  it('strokeLength cộng đúng các đoạn', () => {
    expect(strokeLength(line(0, 0, 30, 40, 3))).toBeCloseTo(50);
  });
});

describe('scoreStroke', () => {
  it('nét trùng khít được điểm tuyệt đối', () => {
    const s = scoreStroke(line(10, 50, 90, 50), HORIZONTAL);
    expect(s.pass).toBe(true); expect(s.score).toBeGreaterThanOrEqual(95); expect(s.reason).toBe('ok');
  });
  it('nét run tay nhẹ vẫn đạt nhưng điểm thấp hơn', () => {
    const s = scoreStroke(wobble(line(10, 50, 90, 50, 30), 3), HORIZONTAL);
    expect(s.pass).toBe(true); expect(s.score).toBeLessThan(100);
  });
  it('nét lệch xa vị trí thì trượt', () => {
    const s = scoreStroke(line(10, 100, 90, 100), HORIZONTAL);
    expect(s.pass).toBe(false); expect(s.reason).toBe('wrong-shape');
  });
  it('nét viết ngược chiều bị nhận ra', () => {
    const s = scoreStroke(line(90, 50, 10, 50), HORIZONTAL);
    expect(s.pass).toBe(false); expect(s.reason).toBe('wrong-direction');
  });
  it('nét quá ngắn bị báo ngắn', () => {
    const s = scoreStroke(line(10, 50, 25, 50), HORIZONTAL);
    expect(s.pass).toBe(false); expect(s.reason).toBe('too-short');
  });
  it('chạm một điểm không phải là nét', () => {
    expect(scoreStroke([{ x: 10, y: 50 }], HORIZONTAL).reason).toBe('too-short');
  });
  it('nét chấm ngắn chỉ cần đúng vị trí', () => {
    const dot = 'M60,20 l2,3';
    expect(scoreStroke([{ x: 60, y: 20 }, { x: 62, y: 23 }], dot).pass).toBe(true);
    expect(scoreStroke([{ x: 20, y: 90 }, { x: 22, y: 92 }], dot).pass).toBe(false);
  });
});

describe('judgeStroke (đúng thứ tự nét)', () => {
  const refs = ['M10,20 L90,20', 'M50,10 L50,90'];
  it('chấp nhận nét đúng thứ tự', () => {
    const j = judgeStroke(line(10, 20, 90, 20), refs, 0);
    expect(j.pass).toBe(true); expect(j.matchedIndex).toBeUndefined();
  });
  it('phát hiện viết nét 2 trước nét 1', () => {
    const j = judgeStroke(line(50, 10, 50, 90), refs, 0);
    expect(j.pass).toBe(false); expect(j.matchedIndex).toBe(1);
  });
  it('bỏ qua nét đã viết xong khi tìm nét khớp', () => {
    const j = judgeStroke(line(10, 20, 90, 20), refs, 1, new Set([0]));
    expect(j.matchedIndex).toBeUndefined();
  });
});

describe('summarize', () => {
  it('điểm cao được 3 sao, sai nhiều bị trừ', () => {
    expect(summarize([95, 90, 100], 0)).toEqual({ score: 95, stars: 3 });
    expect(summarize([95, 90, 100], 5).stars).toBe(2);
  });
  it('không có nét nào thì 0 sao', () => {
    expect(summarize([], 0)).toEqual({ score: 0, stars: 0 });
  });
});
