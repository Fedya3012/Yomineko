import { describe, expect, it } from 'vitest';
import { dragToRegion, isWidePage, locate, spreadContentSize } from './spreadMath';

const tall = { width: 800, height: 1200 };

describe('spreadMath', () => {
  it('sizes a spread of two equal pages as double width', () => {
    expect(spreadContentSize([tall, tall])).toEqual({ w: 1600, h: 1200 });
  });
  it('scales a shorter page up to the same height', () => {
    expect(spreadContentSize([tall, { width: 400, height: 600 }])).toEqual({ w: 1600, h: 1200 });
  });

  it('turns a point on the spread into a point on the right page', () => {
    // screen order: [left page, right page]
    expect(locate([tall, tall], 0.25, 0.5)).toEqual({ slot: 0, x: 400, y: 600 });
    expect(locate([tall, tall], 0.75, 0.5)).toEqual({ slot: 1, x: 400, y: 600 });
    expect(locate([tall], 1, 1)).toEqual({ slot: 0, x: 800, y: 1200 });
  });
  it('returns nothing outside the spread', () => {
    expect(locate([tall], -0.1, 0.5)).toBeUndefined();
    expect(locate([], 0.5, 0.5)).toBeUndefined();
  });

  it('detects wide pages', () => {
    expect(isWidePage({ width: 1800, height: 1200 })).toBe(true);
    expect(isWidePage(tall)).toBe(false);
  });

  it('builds a region from a drag in any direction, clipped to the page', () => {
    expect(dragToRegion({ x: 500, y: 700 }, { x: 100, y: 100 }, tall)).toEqual({ x0: 100, y0: 100, x1: 500, y1: 700 });
    expect(dragToRegion({ x: 700, y: 1100 }, { x: 900, y: 1300 }, tall)).toEqual({ x0: 700, y0: 1100, x1: 800, y1: 1200 });
    expect(dragToRegion({ x: 10, y: 10 }, { x: 20, y: 500 }, tall)).toBeUndefined(); // just a tap or a sliver
  });
});
