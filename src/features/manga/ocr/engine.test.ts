// Runs the REAL offline OCR (tesseract.js + bundled Japanese models) on a generated manga-like page.
// fixtures/page.png: a horizontal bubble ("今日はいい天気ですね / 散歩に行きましょう") and vertical bubbles
// ("猫は静かに本を / 読む。 / ありがとう" and "吾輩は猫である / 名前はまだ無い"), drawn with IPAGothic.
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { OcrEngine } from './engine';

const model = (lang: string) => join('node_modules', '@tesseract.js-data', lang, '4.0.0_best_int', `${lang}.traineddata.gz`);
const langPath = mkdtempSync(join(tmpdir(), 'yomineko-lang-'));
for (const lang of ['jpn', 'jpn_vert']) copyFileSync(model(lang), join(langPath, `${lang}.traineddata.gz`));

const engine = new OcrEngine({ langPath });
const page = readFileSync(join(__dirname, '..', '__fixtures__', 'page.png'));
afterAll(() => engine.dispose());

describe('OcrEngine (real tesseract, offline)', () => {
  it('reads horizontal and vertical Japanese on the same page', async () => {
    const blocks = await engine.recognize(page as unknown as Blob);
    const horizontal = blocks.filter((b) => b.orientation === 'horizontal').map((b) => b.text);
    const vertical = blocks.filter((b) => b.orientation === 'vertical').map((b) => b.text);
    expect(horizontal.join('|')).toContain('今日はいい天気');
    expect(horizontal.join('|')).toContain('散歩に行');
    expect(vertical.join('|')).toContain('猫は静かに本を');
    expect(vertical.join('|')).toContain('ありがとう');
    // every character has a box inside the page
    for (const b of blocks) for (const c of b.chars) {
      expect(c.box.x1).toBeGreaterThan(c.box.x0);
      expect(c.box.y1).toBeGreaterThan(c.box.y0);
      expect(c.box.x1).toBeLessThanOrEqual(900);
      expect(c.box.y1).toBeLessThanOrEqual(1000);
    }
  }, 120_000);

  it('reads only a chosen region, reporting coordinates on the full page', async () => {
    const blocks = await engine.recognize(page as unknown as Blob, { mode: 'vertical', region: { x0: 540, y0: 40, x1: 880, y1: 580 } });
    expect(blocks.map((b) => b.text).join('|')).toContain('ありがとう');
    // coordinates are on the full page, not relative to the region
    for (const b of blocks) for (const c of b.chars) expect(c.box.x0).toBeGreaterThanOrEqual(540);
    expect(blocks.every((b) => b.orientation === 'vertical')).toBe(true);
  }, 120_000);
});
