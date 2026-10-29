// Pure maths that ties the roadmap to what the learner really did (progress + SRS). No database here.
import { addDays } from '../progress/stats';
import type { DayLog } from '../progress/types';
import type { PlanDay, RoadGoal, Roadmap, Task } from './types';

export type Counts = { word: number; kanji: number; grammar: number };
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const KINDS = ['word', 'kanji', 'grammar'] as const;

/** 0 = Monday ... 6 = Sunday, for a YYYY-MM-DD key. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
export const weekStart = (today: string) => addDays(today, -weekdayIndex(today));

/** How far each stage is done (0..1), counting only what was learned since the roadmap started. */
export function stageProgress(road: Roadmap, learned: Counts): number[] {
  return road.stages.map((s, i) => {
    const prev = i ? road.stages[i - 1].upTo : { word: 0, kanji: 0, grammar: 0 };
    const parts = KINDS.filter((k) => s.add[k] > 0).map((k) => clamp01((learned[k] - road.baseline[k] - prev[k]) / s.add[k]));
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  });
}

/** Index of the stage the learner is working on now (the first one not finished). */
export function currentStage(ratios: number[]): number {
  const i = ratios.findIndex((r) => r < 1);
  return i === -1 ? Math.max(0, ratios.length - 1) : i;
}

export interface GoalCtx { logs: Map<string, DayLog>; today: string; learned: Counts; ratios: number[]; road: Roadmap }
export interface GoalState { done: number; target: number; ratio: number; met: boolean }

const studied = (l?: DayLog) => !!l && (l.seconds > 0 || l.cards > 0);

export function goalState(g: RoadGoal, c: GoalCtx): GoalState {
  let done = 0;
  switch (g.metric) {
    case 'days-week':
    case 'minutes-week': {
      for (let d = weekStart(c.today); d <= c.today; d = addDays(d, 1)) {
        const log = c.logs.get(d);
        done += g.metric === 'days-week' ? (studied(log) ? 1 : 0) : Math.floor((log?.seconds ?? 0) / 60);
      }
      break;
    }
    case 'word': case 'kanji': case 'grammar':
      done = Math.max(0, c.learned[g.metric] - c.road.baseline[g.metric]);
      break;
    case 'stage':
      done = Math.round((c.ratios[g.stage ?? 0] ?? 0) * 100) / 100;
      break;
  }
  return { done, target: g.target, ratio: clamp01(done / g.target), met: done >= g.target };
}

export interface TodayTask { task: Task; done: boolean }
export interface TodayState {
  day: PlanDay;
  plannedMinutes: number;
  studiedMinutes: number;
  tasks: TodayTask[];
  /** True when every task is ticked, or the studied time reached the plan. */
  complete: boolean;
}

/** SRS tasks tick themselves once any card was reviewed today; the rest are ticked by hand. */
export function todayState(road: Roadmap, today: string, log: DayLog | undefined, ticks: ReadonlySet<string>, srsReviewed: number): TodayState {
  const day = road.week[weekdayIndex(today)];
  const tasks = day.tasks.map((task) => ({ task, done: ticks.has(task.id) || (task.kind === 'srs' && srsReviewed > 0) }));
  const plannedMinutes = day.tasks.reduce((s, t) => s + t.minutes, 0);
  const studiedMinutes = Math.floor((log?.seconds ?? 0) / 60);
  const complete = !day.rest && ((tasks.length > 0 && tasks.every((t) => t.done)) || (plannedMinutes > 0 && studiedMinutes >= plannedMinutes));
  return { day, plannedMinutes, studiedMinutes, tasks, complete };
}
