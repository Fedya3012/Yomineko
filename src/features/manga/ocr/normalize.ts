// Turns raw tesseract output into clean text blocks. Pure functions: no tesseract, no DOM.
import type { Box, OcrBlock, OcrChar, Orientation, RawBlock, RawLine, RawParagraph } from './types';

const JAPANESE = /[぀-ヿ㐀-䶿一-鿿ｦ-ﾟ々〆]/; // kana, kanji, half-width kana
const SPACE = /\s/;

export const isJapanese = (ch: string) => JAPANESE.test(ch);

const w = (b: Box) => b.x1 - b.x0;
const h = (b: Box) => b.y1 - b.y0;

/** +1 if the line looks like a vertical column, -1 if horizontal, 0 if it is about square (a single glyph). */
export function lineShape(b: Box): 1 | 0 | -1 {
  if (h(b) > w(b) * 1.5) return 1;
  if (w(b) > h(b) * 1.5) return -1;
  return 0;
}

/**
 * Character boxes. tesseract.js's per-symbol boxes are unreliable for Japanese (vertical text comes back with
 * x = 0 and zero width), but its LINE box is accurate, and manga text is set in full-width glyphs. So we
 * share the line box equally between the characters of the line, along the reading direction.
 */
function spreadAlongLine(units: { ch: string; conf: number }[], line: Box, vertical: boolean): OcrChar[] {
  const n = units.length;
  return units.map(({ ch, conf }, i) => ({
    ch, conf,
    box: vertical
      ? { x0: line.x0, x1: line.x1, y0: line.y0 + (i / n) * h(line), y1: line.y0 + ((i + 1) / n) * h(line) }
      : { y0: line.y0, y1: line.y1, x0: line.x0 + (i / n) * w(line), x1: line.x0 + ((i + 1) / n) * w(line) }
  }));
}

export interface NormalizeOptions {
  /** Which model produced this output; decides how ambiguous (square) lines are treated. */
  model: Orientation;
  /** Trust the learner's choice instead of guessing the layout from line shapes. */
  force?: Orientation;
  minSymbolConf?: number;
  minBlockConf?: number;
}

function paragraphToBlock(p: RawParagraph, o: Required<Omit<NormalizeOptions, 'force'>> & Pick<NormalizeOptions, 'force'>, id: number): OcrBlock | undefined {
  const lines = p.lines.filter((l) => l.words.some((wd) => wd.symbols.length));
  if (!lines.length) return undefined;

  // Majority vote of the lines' shapes; a lone square line follows the model that read it.
  const votes = lines.reduce((n, l) => n + lineShape(l.bbox), 0);
  const orientation: Orientation = o.force ?? (votes > 0 ? 'vertical' : votes < 0 ? 'horizontal' : o.model);
  const vertical = orientation === 'vertical';

  // Reading order: vertical text goes right-to-left by column, horizontal top-to-bottom by row.
  const ordered: RawLine[] = [...lines].sort((a, b) => (vertical ? b.bbox.x0 - a.bbox.x0 : a.bbox.y0 - b.bbox.y0));

  const chars: OcrChar[] = [];
  for (const line of ordered) {
    const units = line.words.flatMap((wd) => wd.symbols)
      .flatMap((s) => [...s.text].filter((c) => !SPACE.test(c)).map((ch) => ({ ch, conf: s.confidence })));
    // position first (using every character), then drop the doubtful ones
    const inLine = spreadAlongLine(units, line.bbox, vertical).filter((c) => c.conf >= o.minSymbolConf);
    // symbols inside a line stay in tesseract's order: its glyph boxes can be slightly off, its order is not
    chars.push(...inLine);
  }
  if (!chars.some((c) => isJapanese(c.ch))) return undefined; // artwork noise: "o", "|", "..."

  const conf = chars.reduce((n, c) => n + c.conf, 0) / chars.length;
  if (conf < o.minBlockConf) return undefined;
  if (chars.length === 1 && conf < 70) return undefined; // a lone character must be a confident one

  return { id, orientation, conf, box: p.bbox, chars, text: chars.map((c) => c.ch).join('') };
}

export function toBlocks(raw: RawBlock[] | null | undefined, options: NormalizeOptions): OcrBlock[] {
  const o = { minSymbolConf: 20, minBlockConf: 45, ...options };
  const out: OcrBlock[] = [];
  for (const block of raw ?? []) {
    for (const p of block.paragraphs) {
      const b = paragraphToBlock(p, o, out.length);
      if (b) out.push(b);
    }
  }
  return out;
}

const area = (b: Box) => Math.max(0, w(b)) * Math.max(0, h(b));
function overlap(a: Box, b: Box): number {
  const iw = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const ih = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  if (iw <= 0 || ih <= 0) return 0;
  return (iw * ih) / Math.min(area(a), area(b)); // share of the SMALLER box covered
}

/**
 * Combine the horizontal-model run and the vertical-model run. Each model only gets to keep blocks whose
 * shape matches what it is good at, and if both claim the same spot the more confident one wins.
 */
export function mergeRuns(horizontal: OcrBlock[], vertical: OcrBlock[]): OcrBlock[] {
  const candidates = [
    ...horizontal.filter((b) => b.orientation === 'horizontal'),
    ...vertical.filter((b) => b.orientation === 'vertical')
  ].sort((a, b) => b.conf - a.conf);
  const kept: OcrBlock[] = [];
  for (const c of candidates) {
    if (kept.some((k) => overlap(k.box, c.box) > 0.5)) continue;
    kept.push(c);
  }
  return readingOrder(kept);
}

/** Manga reading order: top-to-bottom, and right-to-left within a row of bubbles. */
export function readingOrder(blocks: OcrBlock[]): OcrBlock[] {
  return [...blocks]
    .sort((a, b) => (Math.abs(a.box.y0 - b.box.y0) < 40 ? b.box.x0 - a.box.x0 : a.box.y0 - b.box.y0))
    .map((b, id) => ({ ...b, id }));
}
