import { describe, expect, it } from 'vitest';
import { hitTest } from './hit';
import { isJapanese, lineShape, mergeRuns, toBlocks } from './normalize';
import type { Box, RawBlock, RawLine } from './types';

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });
const sym = (text: string, b: Box, confidence = 90) => ({ text, confidence, bbox: b });

/** A vertical column of single characters, 30px square each, top-down at x. */
function column(text: string, x: number, y = 100, confidence = 90): RawLine {
  const symbols = [...text].map((c, i) => sym(c, box(x, y + i * 32, x + 30, y + i * 32 + 30), confidence));
  return { bbox: box(x, y, x + 30, y + text.length * 32), words: [{ symbols }] };
}
/** A horizontal row of characters. */
function row(text: string, x: number, y: number, confidence = 90): RawLine {
  const symbols = [...text].map((c, i) => sym(c, box(x + i * 32, y, x + i * 32 + 30, y + 30), confidence));
  return { bbox: box(x, y, x + text.length * 32, y + 30), words: [{ symbols }] };
}
const para = (lines: RawLine[], confidence = 90) => ({
  bbox: box(Math.min(...lines.map((l) => l.bbox.x0)), Math.min(...lines.map((l) => l.bbox.y0)), Math.max(...lines.map((l) => l.bbox.x1)), Math.max(...lines.map((l) => l.bbox.y1))),
  confidence, lines
});
const blocks = (...ps: ReturnType<typeof para>[]): RawBlock[] => [{ paragraphs: ps }];

describe('toBlocks', () => {
  it('recognises vertical text and reads columns right-to-left', () => {
    // tesseract returned the LEFT column first on purpose
    const raw = blocks(para([column('読む。', 400), column('猫は本', 440)]));
    const [b] = toBlocks(raw, { model: 'vertical' });
    expect(b.orientation).toBe('vertical');
    expect(b.text).toBe('猫は本読む。');
  });

  it('recognises horizontal text and reads rows top-to-bottom', () => {
    const raw = blocks(para([row('散歩に行く', 100, 200), row('今日は晴れ', 100, 150)]));
    const [b] = toBlocks(raw, { model: 'horizontal' });
    expect(b.orientation).toBe('horizontal');
    expect(b.text).toBe('今日は晴れ散歩に行く');
  });

  it('drops noise: no Japanese, low confidence, lone weak character', () => {
    const raw = blocks(
      para([row('oo||', 0, 0)]),
      para([row('猫です', 0, 100, 20)], 20),
      para([row('猫', 0, 200, 60)], 60)
    );
    expect(toBlocks(raw, { model: 'horizontal' })).toEqual([]);
  });

  it('removes spaces, drops weak characters but keeps the others where they belong on the line', () => {
    const line: RawLine = {
      bbox: box(0, 0, 400, 30),
      words: [{ symbols: [sym('猫', box(0, 0, 0, 0)), sym(' ', box(0, 0, 0, 0)), sym('は', box(0, 0, 0, 0), 5), sym('12', box(0, 0, 0, 0))] }]
    };
    const [b] = toBlocks(blocks(para([line])), { model: 'horizontal' });
    expect(b.text).toBe('猫12');
    // 4 characters shared the 400px line (猫 は 1 2), so 1 starts at 200 even though は was dropped
    expect(b.chars.map((c) => c.box.x0)).toEqual([0, 200, 300]);
    expect(b.chars[0].box).toEqual(box(0, 0, 100, 30));
  });

  it('splits a vertical line downwards, ignoring bogus symbol boxes', () => {
    const line: RawLine = { bbox: box(792, 94, 828, 402), words: [{ symbols: [...'猫は静かに本を'].map((c) => sym(c, box(0, 0, 0, 0))) }] };
    const [b] = toBlocks(blocks(para([line])), { model: 'vertical' });
    expect(b.chars).toHaveLength(7);
    expect(b.chars[0].box).toEqual(box(792, 94, 828, 94 + 44));
    expect(b.chars[6].box.y1).toBeCloseTo(402);
  });

  it('obeys a forced orientation', () => {
    const [b] = toBlocks(blocks(para([row('猫です', 0, 0)])), { model: 'vertical', force: 'vertical' });
    expect(b.orientation).toBe('vertical');
  });

  it('classifies line shapes', () => {
    expect(lineShape(box(0, 0, 30, 200))).toBe(1);
    expect(lineShape(box(0, 0, 200, 30))).toBe(-1);
    expect(lineShape(box(0, 0, 30, 30))).toBe(0);
  });

  it('knows Japanese characters', () => {
    for (const c of ['猫', 'ね', 'ネ', 'ﾈ', '々']) expect(isJapanese(c)).toBe(true);
    for (const c of ['a', '1', '。', ' ']) expect(isJapanese(c)).toBe(false);
  });
});

describe('mergeRuns', () => {
  const make = (text: string, orientation: 'vertical' | 'horizontal', b: Box, conf: number) =>
    ({ id: 0, text, orientation, box: b, conf, chars: [] });

  it('keeps each model only where its orientation matches, and orders for manga reading', () => {
    const h = [make('よこ', 'horizontal', box(100, 50, 300, 90), 90), make('ゴミ', 'vertical', box(600, 300, 640, 500), 30)];
    const v = [make('たて', 'vertical', box(600, 300, 640, 500), 85), make('ゴミ2', 'horizontal', box(100, 50, 300, 90), 20)];
    const merged = mergeRuns(h, v);
    // the two bubbles are in different rows (y 50 vs 300): top one first
    expect(merged.map((b) => b.text)).toEqual(['よこ', 'たて']);
    expect(merged.map((b) => b.id)).toEqual([0, 1]);
  });

  it('puts the right-hand bubble first within a row', () => {
    const merged = mergeRuns([], [make('左', 'vertical', box(100, 100, 140, 300), 90), make('右', 'vertical', box(500, 110, 540, 300), 90)]);
    expect(merged.map((b) => b.text)).toEqual(['右', '左']);
  });

  it('on a conflict the more confident block wins', () => {
    const merged = mergeRuns([make('弱', 'horizontal', box(0, 0, 100, 40), 50)], []);
    expect(merged).toHaveLength(1);
    const both = mergeRuns(
      [make('弱', 'horizontal', box(0, 0, 100, 40), 50)],
      [make('強', 'vertical', box(10, 0, 90, 40), 90)]
    );
    expect(both.map((b) => b.text)).toEqual(['強']);
  });
});

describe('hitTest', () => {
  const [block] = toBlocks(blocks(para([column('猫は本', 400)])), { model: 'vertical' });

  it('finds the tapped character', () => {
    expect(hitTest([block], 415, 100 + 32 + 10)).toMatchObject({ index: 1 });
  });
  it('forgives a tap just outside the glyph', () => {
    expect(hitTest([block], 440, 115)).toMatchObject({ index: 0 }); // 10px right of the box
  });
  it('ignores taps far from any text', () => {
    expect(hitTest([block], 100, 100)).toBeUndefined();
    expect(hitTest([], 0, 0)).toBeUndefined();
  });
});
