import type { OcrBlock } from './types';

export interface CharHit { block: OcrBlock; index: number }

/**
 * Find the character under a tap, in page-image pixels. Boxes get a little padding because glyph
 * boxes are tight and fingers are not; on a miss we take the nearest character within `slack` pixels.
 */
export function hitTest(blocks: OcrBlock[], x: number, y: number, pad = 6, slack = 24): CharHit | undefined {
  let best: (CharHit & { d: number }) | undefined;
  for (const block of blocks) {
    const b = block.box;
    if (x < b.x0 - slack || x > b.x1 + slack || y < b.y0 - slack || y > b.y1 + slack) continue;
    block.chars.forEach((c, index) => {
      const dx = Math.max(c.box.x0 - x, 0, x - c.box.x1);
      const dy = Math.max(c.box.y0 - y, 0, y - c.box.y1);
      const d = Math.hypot(dx, dy);
      if (d <= pad || d <= slack) {
        if (!best || d < best.d) best = { block, index, d };
      }
    });
  }
  return best && { block: best.block, index: best.index };
}
