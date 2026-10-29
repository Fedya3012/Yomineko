// FSRS-5 (Free Spaced Repetition Scheduler), pure functions, no storage, no clock.
// Every card has two hidden numbers:
//   stability  S : how many days until the chance of remembering falls to the target (90% by default)
//   difficulty D : 1 (easy) .. 10 (hard)
// After each answer we update S and D, then turn S into "come back in N days".
// Fail a card (Again) -> S shrinks -> it returns soon. Know it well (Easy) -> S grows a lot -> it returns late.

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Phase = 'new' | 'learning' | 'review' | 'relearning';

export interface FsrsCard {
  phase: Phase;
  stability: number;   // days
  difficulty: number;  // 1..10
  due: number;         // epoch ms
  lastReview: number;  // epoch ms, 0 when new
  reps: number;
  lapses: number;      // times answered Again after having learned it
}

// Default FSRS-5 weights (published by the open-spaced-repetition project).
export const DEFAULT_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621
];

export interface FsrsParams { retention: number; maxIntervalDays: number; weights: number[] }
export const DEFAULT_PARAMS: FsrsParams = { retention: 0.9, maxIntervalDays: 365, weights: DEFAULT_WEIGHTS };

const DAY = 86_400_000;
const MINUTE = 60_000;
/** A failed card is shown again after this long (and re-queued inside the current session). */
export const RELEARN_DELAY_MS = 10 * MINUTE;

const DECAY = -0.5;
const FACTOR = 19 / 81; // makes retrievability exactly 90% when elapsed days == stability
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export const newCard = (now = 0): FsrsCard =>
  ({ phase: 'new', stability: 0, difficulty: 0, due: now, lastReview: 0, reps: 0, lapses: 0 });

/** Chance (0..1) that the learner still remembers the card `elapsedDays` after the last review. */
export const retrievability = (elapsedDays: number, stability: number) =>
  Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);

/** Days until retrievability drops to `retention`. */
export const nextInterval = (stability: number, p: FsrsParams) =>
  clamp(Math.round((stability / FACTOR) * (Math.pow(p.retention, 1 / DECAY) - 1)), 1, p.maxIntervalDays);

const initStability = (g: Rating, w: number[]) => Math.max(w[g - 1], 0.1);
const initDifficulty = (g: Rating, w: number[]) => clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);

function nextDifficulty(d: number, g: Rating, w: number[]) {
  const delta = -w[6] * (g - 3);
  const damped = d + (delta * (10 - d)) / 9;          // moves less as D nears 10
  return clamp(w[7] * initDifficulty(4, w) + (1 - w[7]) * damped, 1, 10); // pulled gently toward "easy start"
}

function recallStability(d: number, s: number, r: number, g: Rating, w: number[]) {
  const hard = g === 2 ? w[15] : 1;
  const easy = g === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
}

function forgetStability(d: number, s: number, r: number, w: number[]) {
  const next = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return Math.min(next, s);
}

// Reviews repeated within the same day (typical inside a session) use a gentler rule.
const sameDayStability = (s: number, g: Rating, w: number[]) => s * Math.exp(w[17] * (g - 3 + w[18]));

/** Apply one answer. Returns a new card; the input is never mutated. */
export function review(card: FsrsCard, rating: Rating, now: number, params: FsrsParams = DEFAULT_PARAMS): FsrsCard {
  const w = params.weights;
  let stability: number, difficulty: number;
  let lapses = card.lapses;

  if (card.phase === 'new') {
    stability = initStability(rating, w);
    difficulty = initDifficulty(rating, w);
  } else {
    const elapsed = (now - card.lastReview) / DAY;
    difficulty = nextDifficulty(card.difficulty, rating, w);
    if (elapsed < 1) {
      stability = sameDayStability(card.stability, rating, w);
    } else {
      const r = retrievability(elapsed, card.stability);
      stability = rating === 1 ? forgetStability(card.difficulty, card.stability, r, w)
                               : recallStability(card.difficulty, card.stability, r, rating, w);
    }
    if (rating === 1 && card.phase === 'review') lapses += 1;
  }
  stability = Math.max(stability, 0.01);

  let phase: Phase, due: number;
  if (rating === 1) {
    phase = card.phase === 'new' || card.phase === 'learning' ? 'learning' : 'relearning';
    due = now + RELEARN_DELAY_MS;
  } else {
    phase = 'review';
    due = now + nextInterval(stability, params) * DAY;
  }
  return { phase, stability, difficulty, due, lastReview: now, reps: card.reps + 1, lapses };
}

/** What each button would schedule, to label the buttons ("10 phút", "3 ngày"). */
export const previewIntervals = (card: FsrsCard, now: number, params: FsrsParams = DEFAULT_PARAMS) =>
  ([1, 2, 3, 4] as Rating[]).map((g) => review(card, g, now, params).due - now);

export function formatInterval(ms: number): string {
  if (ms < 60 * MINUTE) return `${Math.max(1, Math.round(ms / MINUTE))} phút`;
  if (ms < DAY) return `${Math.round(ms / (60 * MINUTE))} giờ`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days} ngày`;
  if (days < 365) return `${Math.round(days / 30)} tháng`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')} năm`;
}
