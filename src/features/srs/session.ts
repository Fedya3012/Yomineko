// One review session: the queue, answering, bury, and Undo. No UI and no direct database access
// (storage is injected as `Persist`), so it is easy to test.
import { DEFAULT_PARAMS, newCard, review, type Rating } from './fsrs';
import { dayKey } from './store';
import type { CardContent, CardState, DayStats, SrsSettings } from './types';

export const UNDO_WINDOW_MS = 6000;
export const QUICK_SESSION_MS = 5 * 60_000;
const DAY = 86_400_000;
/** After Again, the card comes back after this many other cards. */
const REQUEUE_GAP = 3;
export const LEARNED_STABILITY_DAYS = 21;

export interface Persist {
  saveState(state: CardState): Promise<void>;
  deleteState(cardId: string): Promise<void>;
  saveStats(day: string, stats: DayStats): Promise<void>;
}

export interface QueueInput {
  cards: CardContent[]; states: Map<string, CardState>; settings: SrsSettings; stats: DayStats; now: number;
}

/** Due cards first (oldest due first), then new cards up to today's allowance. */
export function buildQueue({ cards, states, settings, stats, now }: QueueInput): string[] {
  const known = new Set(cards.map((c) => c.id));
  const due = [...states.values()]
    .filter((s) => known.has(s.cardId) && s.due <= now && (s.buriedUntil ?? 0) <= now)
    .sort((a, b) => a.due - b.due)
    .map((s) => s.cardId);
  const allowance = Math.max(0, settings.newPerDay - stats.newCards);
  const fresh = cards.filter((c) => !states.has(c.id)).slice(0, allowance).map((c) => c.id);
  return [...due, ...fresh];
}

/** For the home screen: how many cards are due now, and how many new ones are still allowed today. */
export function countQueue(i: QueueInput) {
  const due = buildQueue({ ...i, settings: { ...i.settings, newPerDay: 0 } }).length;
  return { due, fresh: buildQueue(i).length - due };
}

interface UndoEntry {
  cardId: string; at: number; wasAnswer: boolean;
  prevState: CardState | undefined; prevStats: DayStats; prevQueue: string[];
}

export class ReviewSession {
  private queue: string[];
  private undoEntry?: UndoEntry;
  private readonly byId: Map<string, CardContent>;
  readonly deadline?: number;
  answered = 0;
  /** What was answered this session, for the Progress feature (Undo removes the last entry). */
  readonly answerLog: { cardId: string; correct: boolean; learned: boolean }[] = [];

  constructor(
    private cards: CardContent[],
    private states: Map<string, CardState>,
    private settings: SrsSettings,
    private stats: DayStats,
    private persist: Persist,
    opts: { now: number; quick?: boolean }
  ) {
    this.byId = new Map(cards.map((c) => [c.id, c]));
    this.queue = buildQueue({ cards, states, settings, stats, now: opts.now });
    if (opts.quick) this.deadline = opts.now + QUICK_SESSION_MS;
  }

  get remaining() { return this.queue.length; }
  get currentCard(): CardContent | undefined { return this.byId.get(this.queue[0]); }
  currentState(): CardState | undefined { return this.queue.length ? this.states.get(this.queue[0]) : undefined; }
  get todayStats() { return this.stats; }
  finished(now: number) { return this.queue.length === 0 || (this.deadline !== undefined && now >= this.deadline); }

  /** Whether Undo can still be pressed, and how many ms are left. */
  undoMsLeft(now: number) { return this.undoEntry ? Math.max(0, UNDO_WINDOW_MS - (now - this.undoEntry.at)) : 0; }

  async answer(rating: Rating, now: number): Promise<CardState> {
    const cardId = this.queue[0];
    if (cardId === undefined) throw new Error('Không còn thẻ nào để ôn');
    const prev = this.states.get(cardId);
    this.remember(cardId, prev, now, true);

    const params = { ...DEFAULT_PARAMS, retention: this.settings.retention };
    const wasNew = !prev || prev.phase === 'new';
    const next: CardState = { ...review(prev ?? newCard(now), rating, now, params), cardId };

    const stats: DayStats = { ...this.stats, reviewed: this.stats.reviewed + 1 };
    if (wasNew) stats.newCards += 1;
    stats[(['again', 'hard', 'good', 'easy'] as const)[rating - 1]] += 1;

    this.queue.shift();
    if (rating === 1) this.queue.splice(Math.min(REQUEUE_GAP, this.queue.length), 0, cardId);

    this.states.set(cardId, next);
    this.stats = stats;
    this.answered += 1;
    // "Learned" = the memory is now expected to last 3+ weeks.
    this.answerLog.push({ cardId, correct: rating > 1, learned: rating > 1 && next.stability >= LEARNED_STABILITY_DAYS });
    await this.persist.saveState(next);
    await this.persist.saveStats(dayKey(now), stats);
    return next;
  }

  /** "Not now": hides the card until tomorrow without changing how well it is known. */
  async bury(now: number) {
    const cardId = this.queue[0];
    if (cardId === undefined) return;
    const prev = this.states.get(cardId);
    this.remember(cardId, prev, now, false);
    this.queue.shift();
    // A brand-new card has no state yet; burying it simply skips it for this session.
    if (prev) {
      const next = { ...prev, buriedUntil: now + DAY };
      this.states.set(cardId, next);
      await this.persist.saveState(next);
    }
  }

  /** Reverses the last action if it happened less than UNDO_WINDOW_MS ago. Returns false when too late. */
  async undo(now: number): Promise<boolean> {
    const e = this.undoEntry;
    if (!e || now - e.at > UNDO_WINDOW_MS) { this.undoEntry = undefined; return false; }
    if (e.prevState) { this.states.set(e.cardId, e.prevState); await this.persist.saveState(e.prevState); }
    else { this.states.delete(e.cardId); await this.persist.deleteState(e.cardId); }
    this.stats = e.prevStats;
    await this.persist.saveStats(dayKey(e.at), e.prevStats);
    this.queue = e.prevQueue;
    if (e.wasAnswer) { this.answered = Math.max(0, this.answered - 1); this.answerLog.pop(); }
    this.undoEntry = undefined;
    return true;
  }

  private remember(cardId: string, prevState: CardState | undefined, now: number, wasAnswer: boolean) {
    this.undoEntry = { cardId, at: now, wasAnswer, prevState, prevStats: this.stats, prevQueue: [...this.queue] };
  }
}
