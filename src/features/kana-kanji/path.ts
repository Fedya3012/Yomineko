// Chuyển đường nét SVG (lệnh M m L l H h V v C c S s Q q T t Z z) thành dãy điểm để so khớp nét viết tay.
import type { Point } from './types';

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, z: 0 };

function tokenize(d: string): (string | number)[] {
  return (d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []).map((t) => (/[a-zA-Z]/.test(t) ? t : parseFloat(t)));
}

const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const out: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    });
  }
  return out;
}

/** Biến đường nét thành đa tuyến (nhiều đoạn thẳng nhỏ). */
export function pathToPoints(d: string, curveSteps = 12): Point[] {
  const tokens = tokenize(d);
  const pts: Point[] = [];
  let cur: Point = { x: 0, y: 0 }, start: Point = { x: 0, y: 0 };
  let lastCtrl: Point | null = null, lastQuad: Point | null = null;
  let i = 0, cmd = '';
  while (i < tokens.length) {
    if (typeof tokens[i] === 'string') cmd = tokens[i++] as string;
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const n = ARGS[cmd.toLowerCase()];
    if (n === undefined) throw new Error(`Lệnh đường nét chưa hỗ trợ: ${cmd}`);
    const a = tokens.slice(i, i + n) as number[];
    if (a.length < n) throw new Error('Đường nét bị cụt');
    i += n;
    const base = rel ? cur : { x: 0, y: 0 };
    const P = (k: number): Point => ({ x: base.x + a[k], y: base.y + a[k + 1] });
    const lower = cmd.toLowerCase();
    let ctrl: Point | null = null, quad: Point | null = null;
    if (lower === 'm') { cur = P(0); start = cur; pts.push(cur); }
    else if (lower === 'l') { cur = P(0); pts.push(cur); }
    else if (lower === 'h') { cur = { x: rel ? cur.x + a[0] : a[0], y: cur.y }; pts.push(cur); }
    else if (lower === 'v') { cur = { x: cur.x, y: rel ? cur.y + a[0] : a[0] }; pts.push(cur); }
    else if (lower === 'c') {
      const p1 = P(0), p2 = P(2), p3 = P(4);
      pts.push(...cubic(cur, p1, p2, p3, curveSteps)); cur = p3; ctrl = p2;
    } else if (lower === 's') {
      const p1 = lastCtrl ? { x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y } : cur;
      const p2 = P(0), p3 = P(2);
      pts.push(...cubic(cur, p1, p2, p3, curveSteps)); cur = p3; ctrl = p2;
    } else if (lower === 'q' || lower === 't') {
      const q: Point = lower === 'q' ? P(0) : lastQuad ? { x: 2 * cur.x - lastQuad.x, y: 2 * cur.y - lastQuad.y } : cur;
      const end = lower === 'q' ? P(2) : P(0);
      const c1 = lerp(cur, q, 2 / 3), c2 = lerp(end, q, 2 / 3);
      pts.push(...cubic(cur, c1, c2, end, curveSteps)); cur = end; quad = q;
    } else if (lower === 'z') { cur = start; pts.push(cur); }
    lastCtrl = ctrl; lastQuad = quad;
  }
  return pts;
}
