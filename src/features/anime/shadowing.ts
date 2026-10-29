// Shadowing: the learner repeats a line after the original audio; we compare the two recordings.
//
// Two independent signals, both computed locally:
//  1. Sound similarity: log-mel energy features of both clips, aligned with Dynamic Time Warping (DTW),
//     so speaking a bit faster or slower is not punished, but different sounds are.
//  2. Text accuracy (optional): if the browser can transcribe the learner (SpeechRecognition),
//     compare the transcript with the subtitle after converting everything to hiragana.

/** Katakana -> hiragana, strip spaces and punctuation, so "ネコ" == "ねこ". */
export function normalizeKana(s: string): string {
  return s
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s、。，．,.!?！？「」『』（）()…・~〜ー-]/g, '');
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** 0..100 similarity of two Japanese strings (kana-normalized). */
export function textSimilarity(expected: string, heard: string): number {
  const a = normalizeKana(expected), b = normalizeKana(heard);
  if (!a && !b) return 100;
  return Math.round((1 - levenshtein(a, b) / Math.max(a.length, b.length)) * 100);
}

// ---------- sound features ----------

function fftMagnitudes(re: Float64Array): Float64Array {
  // In-place iterative radix-2 FFT; input length must be a power of two. Returns |X[k]| for k < n/2.
  const n = re.length, im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = i + k + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
  const mag = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

const hz2mel = (f: number) => 2595 * Math.log10(1 + f / 700);
const mel2hz = (m: number) => 700 * (10 ** (m / 2595) - 1);

/** Log-mel filterbank features, one vector per 10 ms hop. Each clip is mean/variance normalized so
 *  microphone loudness and tone do not matter. */
export function melFeatures(samples: Float32Array, sampleRate: number, bands = 24): Float64Array[] {
  const frame = 512, hop = Math.round(sampleRate * 0.01);
  const edges = Array.from({ length: bands + 2 }, (_, i) =>
    mel2hz(hz2mel(80) + ((hz2mel(Math.min(7600, sampleRate / 2)) - hz2mel(80)) * i) / (bands + 1)));
  const bin = (f: number) => Math.min(frame / 2 - 1, Math.floor((f / (sampleRate / 2)) * (frame / 2)));
  const window = Float64Array.from({ length: frame }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1)));
  const out: Float64Array[] = [];
  for (let start = 0; start + frame <= samples.length; start += hop) {
    const buf = new Float64Array(frame);
    let prev = 0;
    for (let i = 0; i < frame; i++) {
      const x = samples[start + i];
      buf[i] = (x - 0.97 * prev) * window[i]; // pre-emphasis lifts the consonants
      prev = x;
    }
    const mag = fftMagnitudes(buf);
    const f = new Float64Array(bands);
    for (let b = 0; b < bands; b++) {
      let e = 0;
      for (let k = bin(edges[b]); k <= bin(edges[b + 2]); k++) {
        const pos = (k * (sampleRate / 2)) / (frame / 2);
        const w = pos < edges[b + 1] ? (pos - edges[b]) / (edges[b + 1] - edges[b]) : (edges[b + 2] - pos) / (edges[b + 2] - edges[b + 1]);
        if (w > 0) e += w * mag[k] * mag[k];
      }
      f[b] = Math.log(e + 1e-8);
    }
    out.push(f);
  }
  // normalize per band across the clip
  for (let b = 0; b < bands && out.length; b++) {
    let mean = 0; for (const v of out) mean += v[b]; mean /= out.length;
    let varr = 0; for (const v of out) varr += (v[b] - mean) ** 2;
    const sd = Math.sqrt(varr / out.length) || 1;
    for (const v of out) v[b] = (v[b] - mean) / sd;
  }
  return out;
}

/** Drop leading/trailing silence so a late start doesn't count as a mistake. */
export function trimSilence(samples: Float32Array, sampleRate: number, ratio = 0.06): Float32Array {
  const win = Math.max(1, Math.round(sampleRate * 0.02));
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const thr = peak * ratio;
  if (peak === 0) return samples.subarray(0, 0);
  let s = 0, e = samples.length;
  while (s < e && Math.abs(samples[s]) < thr) s += win;
  while (e > s && Math.abs(samples[e - 1]) < thr) e -= win;
  return samples.subarray(Math.max(0, s - win), Math.min(samples.length, e + win));
}

/** Average per-step distance of the best alignment between two feature sequences (DTW, Sakoe-Chiba band). */
export function dtwDistance(a: Float64Array[], b: Float64Array[]): number {
  const n = a.length, m = b.length;
  if (!n || !m) return Infinity;
  const band = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * 0.3));
  const cost = (x: Float64Array, y: Float64Array) => {
    let s = 0; for (let i = 0; i < x.length; i++) s += (x[i] - y[i]) ** 2;
    return Math.sqrt(s / x.length);
  };
  let prev = new Float64Array(m + 1).fill(Infinity), cur = new Float64Array(m + 1);
  prev[0] = 0;
  for (let i = 1; i <= n; i++) {
    cur.fill(Infinity);
    const centre = Math.round((i * m) / n);
    for (let j = Math.max(1, centre - band); j <= Math.min(m, centre + band); j++) {
      cur[j] = cost(a[i - 1], b[j - 1]) + Math.min(prev[j], prev[j - 1], cur[j - 1]);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m] / (n + m);
}

export interface ShadowResult {
  /** 0..100: how close the sound is to the original. */
  sound: number;
  /** 0..100: spoken length vs original length (100 = same pace). */
  pace: number;
  /** 0..100 when a transcript is available. */
  text?: number;
  overall: number;
}

/** Map a DTW distance to 0..100. Calibrated on synthetic data: identical ~0 -> 100, unrelated ~1.3+ -> 0. */
export function distanceToScore(d: number): number {
  if (!Number.isFinite(d)) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - d / 1.3) * 100)));
}

export function compareRecordings(
  reference: Float32Array, learner: Float32Array, sampleRate: number,
  opts: { expectedText?: string; heardText?: string } = {}
): ShadowResult {
  const ref = trimSilence(reference, sampleRate), me = trimSilence(learner, sampleRate);
  const sound = distanceToScore(dtwDistance(melFeatures(ref, sampleRate), melFeatures(me, sampleRate)));
  const ratio = ref.length && me.length ? Math.min(ref.length, me.length) / Math.max(ref.length, me.length) : 0;
  const pace = Math.round(ratio * 100);
  const text = opts.expectedText !== undefined && opts.heardText !== undefined
    ? textSimilarity(opts.expectedText, opts.heardText) : undefined;
  const parts = text === undefined ? [sound * 0.8 + pace * 0.2] : [sound * 0.5 + pace * 0.1 + text * 0.4];
  return { sound, pace, text, overall: Math.round(parts[0]) };
}
