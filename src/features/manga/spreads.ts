// Page layout: which pages are shown together, and in which left/right order.

export type Direction = 'rtl' | 'ltr'; // rtl = right-to-left (Japanese manga), ltr = western comics
export type ViewMode = 'single' | 'double';

export interface LayoutOptions {
  mode: ViewMode;
  /** Keep page 1 (the cover) on its own so the rest pair up like a printed book. */
  coverAlone: boolean;
}

/**
 * Group page numbers (0-based) into spreads, in *reading order*.
 * Wide pages (already a two-page spread, or landscape) are always shown alone.
 */
export function buildSpreads(pageCount: number, isWide: (page: number) => boolean, opts: LayoutOptions): number[][] {
  const spreads: number[][] = [];
  if (opts.mode === 'single') {
    for (let i = 0; i < pageCount; i++) spreads.push([i]);
    return spreads;
  }
  let i = 0;
  while (i < pageCount) {
    const alone = (i === 0 && opts.coverAlone) || isWide(i) || i + 1 >= pageCount || isWide(i + 1);
    if (alone) { spreads.push([i]); i += 1; }
    else { spreads.push([i, i + 1]); i += 2; }
  }
  return spreads;
}

/** Left-to-right order on screen. In rtl books the earlier page sits on the right. */
export function screenOrder(spread: number[], direction: Direction): number[] {
  return direction === 'rtl' ? [...spread].reverse() : [...spread];
}

export function spreadIndexOf(spreads: number[][], page: number): number {
  const i = spreads.findIndex((s) => s.includes(page));
  return i === -1 ? 0 : i;
}

/**
 * Which way "next" lies for an arrow key / screen edge. In rtl books the right arrow goes BACK
 * (like turning a Japanese book), so "next" is the left arrow.
 */
export function arrowToStep(key: 'ArrowLeft' | 'ArrowRight', direction: Direction): 1 | -1 {
  const rightIsNext = direction === 'ltr';
  return (key === 'ArrowRight') === rightIsNext ? 1 : -1;
}
