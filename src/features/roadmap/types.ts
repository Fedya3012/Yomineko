// Data shapes for the roadmap feature. Everything lives in the `userdata` store (keys `roadmap.*`);
// content packs are never written. The roadmap only *links* to SRS, progress, anime and lessons.

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export const LEVELS: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1'];
/** Level the learner has already passed. `none` = starting from zero. */
export type CurrentLevel = 'none' | 'N5' | 'N4' | 'N3' | 'N2';
export type Goal = 'jlpt' | 'anime' | 'manga' | 'conversation';
export type Content = 'onepiece' | 'dgrayman' | 'both' | 'other';
export type WeakPoint = 'kanji' | 'vocab' | 'grammar' | 'listening' | 'reading' | 'speaking';
export type Style = 'srs' | 'immersion' | 'balanced' | 'textbook';
export type Book = 'minna' | 'genki' | 'any';

/** The onboarding answers. These alone (plus the clock and learner data) decide the whole roadmap. */
export interface Answers {
  level: CurrentLevel;
  goal: Goal;
  targetLevel: JlptLevel;
  minutesPerDay: number;
  daysPerWeek: number;
  content: Content;
  weak: WeakPoint[];
  style: Style;
  book: Book;
}

export const DEFAULT_ANSWERS: Answers = {
  level: 'none', goal: 'jlpt', targetLevel: 'N5', minutesPerDay: 15, daysPerWeek: 6,
  content: 'both', weak: [], style: 'balanced', book: 'any'
};

export type Activity = 'srs' | 'kanji' | 'grammar' | 'lesson' | 'manga' | 'anime' | 'speaking';
/** Where a task opens. Some screens (kanji, manga, lessons) belong to threads that are not merged yet. */
export type LinkTarget = 'srs' | 'kanji' | 'lesson' | 'manga' | 'anime' | 'dictionary' | 'assistant' | 'progress';

export interface Task {
  /** Stable inside one plan: `<weekday>:<slot>:<kind>`. Used to remember ticks. */
  id: string;
  kind: Activity;
  minutes: number;
  title: string;
  detail: string;
  link: LinkTarget;
  /** Set when the task points at a real lesson from the `lessons` collection. */
  lessonId?: string;
}

/** `index` 0 = Monday ... 6 = Sunday. */
export interface PlanDay { index: number; rest: boolean; tasks: Task[] }

export interface Stage {
  level: JlptLevel;
  weeks: number;
  /** First day of the stage, YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  focus: string[];
  /** New items this stage adds on top of the previous one (not cumulative). */
  add: { word: number; kanji: number; grammar: number };
  /** Cumulative item counts (relative to the baseline) at the end of the stage. */
  upTo: { word: number; kanji: number; grammar: number };
  /** Suggested immersion range for this stage; numbers are chapters / episodes of the chosen series. */
  immersion: { manga: [number, number | null]; anime: [number, number | null] };
}

export type GoalMetric = 'days-week' | 'minutes-week' | 'word' | 'kanji' | 'grammar' | 'stage';
export interface RoadGoal {
  id: string;
  term: 'short' | 'long';
  title: string;
  metric: GoalMetric;
  target: number;
  dueDate?: string;
  /** For `stage` goals: index into `stages`. */
  stage?: number;
}

export interface Roadmap {
  version: 1;
  generatedAt: string;
  source: 'rules' | 'ai';
  answers: Answers;
  startLevel: JlptLevel;
  summary: string;
  tips: string[];
  /** Plain-language reason shown when the AI part was skipped. */
  notice?: string;
  stages: Stage[];
  week: PlanDay[];
  goals: RoadGoal[];
  /** Learned counts when the roadmap started; progress is measured from here. */
  baseline: { word: number; kanji: number; grammar: number };
  /** What we suggest for the other features (applied only when the learner agrees). */
  suggest: { srsNewPerDay: number; goalMinutes: number };
}

/** A lesson from the `lessons` collection. Only these fields are read. */
export interface LessonRef { id: string; title?: string; level?: string; order?: number; book?: string }

/** Things the app already knows about the learner; they make regeneration smarter. */
export interface Signals {
  /** Average studied minutes over the last 14 days (days off count as 0). */
  avgMinutes14?: number;
  weakKinds?: ('word' | 'kanji' | 'grammar')[];
  learned?: { word: number; kanji: number; grammar: number };
}
