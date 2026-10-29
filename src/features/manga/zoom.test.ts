import { describe, expect, it } from 'vitest';
import { clampPan, clampScale, FIT_VIEW, fitSize, toggleZoom, viewToContent, zoomAt } from './zoom';

describe('zoom', () => {
  it('clamps the scale', () => {
    expect(clampScale(0.2)).toBe(1);
    expect(clampScale(99)).toBe(5);
  });

  it('fits content inside the viewport without distortion', () => {
    expect(fitSize({ w: 1000, h: 1500 }, { w: 500, h: 500 })).toEqual({ w: 500 * (1000 / 1500), h: 500 });
    expect(fitSize({ w: 0, h: 10 }, { w: 5, h: 5 })).toEqual({ w: 0, h: 0 });
  });

  it('keeps the point under the finger fixed while zooming', () => {
    const next = zoomAt(FIT_VIEW, 2, 100, 50);
    // content point under (100,50) before: (100,50); after: (100 - x)/2 must equal it
    expect((100 - next.x) / next.scale).toBeCloseTo(100);
    expect((50 - next.y) / next.scale).toBeCloseTo(50);
  });

  it('does not let the page be dragged away, and centres a page smaller than the screen', () => {
    const viewport = { w: 400, h: 600 };
    const content = { w: 400, h: 600 };
    expect(clampPan({ scale: 1, x: 80, y: -80 }, viewport, content)).toEqual({ scale: 1, x: 0, y: 0 });
    expect(clampPan({ scale: 2, x: 999, y: -999 }, viewport, content)).toEqual({ scale: 2, x: 200, y: -300 });
  });

  it('maps a screen point to a 0..1 point on the page', () => {
    const content = { w: 400, h: 600 };
    expect(viewToContent(FIT_VIEW, content, 0, 0)).toEqual({ u: 0.5, v: 0.5 });
    expect(viewToContent(FIT_VIEW, content, -200, -300)).toEqual({ u: 0, v: 0 });
    // zoomed 2x and panned: the page's top-left corner moved
    expect(viewToContent({ scale: 2, x: -100, y: 0 }, content, -500, -600)).toEqual({ u: 0, v: 0 });
  });

  it('double-tap zooms in, then back out', () => {
    const zoomed = toggleZoom(FIT_VIEW, 10, 10);
    expect(zoomed.scale).toBeGreaterThan(2);
    expect(toggleZoom(zoomed, 0, 0)).toEqual(FIT_VIEW);
  });
});
