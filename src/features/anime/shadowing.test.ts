import { describe, expect, it } from 'vitest';
import { compareRecordings, levenshtein, normalizeKana, textSimilarity } from './shadowing';

const SR = 16000;
/** Fake "speech": a sequence of syllables, each a different mix of harmonics, with a little noise. */
function speech(syllables: number[], speed = 1, seed = 1, noise = 0.02): Float32Array {
  let r = seed;
  const rand = () => ((r = (r * 1664525 + 1013904223) >>> 0) / 2 ** 32) - 0.5;
  const dur = Math.round(0.18 * SR / speed), out = new Float32Array(dur * syllables.length + SR / 5);
  syllables.forEach((f, si) => {
    for (let i = 0; i < dur; i++) {
      const t = i / SR, env = Math.sin((Math.PI * i) / dur);
      out[SR / 10 + si * dur + i] = env * (0.5 * Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.7 * t) + 0.2 * Math.sin(2 * Math.PI * f * 5.1 * t)) + noise * rand();
    }
  });
  return out;
}
const line = [300, 700, 450, 1200, 520, 900, 350];
const other = [1500, 250, 1100, 400, 1700, 600, 1300];

describe('text accuracy', () => {
  it('normalizes katakana and punctuation', () => {
    expect(normalizeKana('ネコ、です。')).toBe('ねこです');
    expect(levenshtein('ねこ', 'ねご')).toBe(1);
  });
  it('scores transcripts', () => {
    expect(textSimilarity('猫は本を読む', '猫は本を読む')).toBe(100);
    expect(textSimilarity('ねこがすき', 'ネコガスキ')).toBe(100);
    expect(textSimilarity('ねこがすき', 'いぬがきらい')).toBeLessThan(50);
  });
});

describe('sound comparison', () => {
  it('rates the same line (different take, louder, a bit faster) much higher than a different line', () => {
    const ref = speech(line, 1, 1);
    const same = speech(line, 1.15, 7).map((x) => x * 2.5) as Float32Array;
    const diff = speech(other, 1, 9);
    const good = compareRecordings(ref, same, SR);
    const bad = compareRecordings(ref, diff, SR);
    expect(good.sound).toBeGreaterThan(bad.sound + 20);
    expect(good.overall).toBeGreaterThan(bad.overall);
    expect(good.pace).toBeGreaterThan(80);
  });
  it('scores an identical clip near 100 and silence at 0', () => {
    const ref = speech(line);
    expect(compareRecordings(ref, ref, SR).sound).toBeGreaterThanOrEqual(98);
    expect(compareRecordings(ref, new Float32Array(SR), SR).overall).toBe(0);
  });
  it('mixes in the transcript score when available', () => {
    const ref = speech(line);
    const r = compareRecordings(ref, ref, SR, { expectedText: 'ねこ', heardText: 'いぬ' });
    expect(r.text).toBe(0);
    expect(r.overall).toBeLessThan(compareRecordings(ref, ref, SR).overall);
  });
});
