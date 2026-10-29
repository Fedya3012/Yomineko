import type { Size } from './zoom';

export interface PageDims { width: number; height: number }

/**
 * Pages of a spread are drawn side by side at the same height (the tallest page's height), so a
 * point on the spread is a fraction (u, v) of one shared rectangle.
 */
export function spreadContentSize(pages: PageDims[]): Size {
  const H = Math.max(...pages.map((p) => p.height), 1);
  return { w: pages.reduce((n, p) => n + (p.width * H) / p.height, 0) || 1, h: H };
}

/** Which page (slot in screen order) is at (u, v) of the spread, and where in that page's own pixels. */
export function locate(pages: PageDims[], u: number, v: number): { slot: number; x: number; y: number } | undefined {
  if (!pages.length || u < 0 || u > 1 || v < 0 || v > 1) return undefined;
  const { w: W, h: H } = spreadContentSize(pages);
  const px = u * W;
  let start = 0;
  for (let slot = 0; slot < pages.length; slot++) {
    const p = pages[slot];
    const width = (p.width * H) / p.height;
    if (px <= start + width || slot === pages.length - 1) {
      return { slot, x: ((px - start) / width) * p.width, y: v * p.height };
    }
    start += width;
  }
  return undefined;
}

/** Page is wider than tall: a double-page spread or a landscape scan, shown alone. */
export const isWidePage = (p: PageDims) => p.width > p.height * 1.1;

/** Normalise a drag from two corners into a box inside the page, or undefined if it is too small to be a region. */
export function dragToRegion(
  a: { x: number; y: number }, b: { x: number; y: number }, page: PageDims, minSize = 24
) {
  const clamp = (n: number, max: number) => Math.min(max, Math.max(0, n));
  const box = {
    x0: clamp(Math.min(a.x, b.x), page.width), y0: clamp(Math.min(a.y, b.y), page.height),
    x1: clamp(Math.max(a.x, b.x), page.width), y1: clamp(Math.max(a.y, b.y), page.height)
  };
  return box.x1 - box.x0 >= minSize && box.y1 - box.y0 >= minSize ? box : undefined;
}
