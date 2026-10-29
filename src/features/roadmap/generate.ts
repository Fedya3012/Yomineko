// Rule-based roadmap generator. Pure: no database, no network, no clock (pass `now`).
// This is both the offline fallback and the backbone the optional AI step only decorates.
import { addDays, dateKey } from '../progress/stats';
import {
  ACTIVITY_LINK, GOAL_BOOST, GOAL_DEFAULT_TARGET, LABELS, LEVEL_INFO, NEXT_LEVEL, STUDY_DAYS, STYLE_WEIGHT, WEAK_BOOST
} from './data';
import {
  DEFAULT_ANSWERS, LEVELS, type Activity, type Answers, type JlptLevel, type LessonRef, type PlanDay, type RoadGoal,
  type Roadmap, type Signals, type Stage, type Task
} from './types';

const round5 = (n: number) => Math.round(n / 5) * 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const levelIndex = (l: JlptLevel) => LEVELS.indexOf(l);

/** Fills gaps and keeps every number in a sane range, so any saved or edited answers are safe to plan from. */
export function normalizeAnswers(raw: Partial<Answers> = {}): Answers {
  const a = { ...DEFAULT_ANSWERS, ...raw };
  const start = NEXT_LEVEL[a.level] ?? 'N5';
  const wanted = LEVELS.includes(a.targetLevel) ? a.targetLevel : GOAL_DEFAULT_TARGET[a.goal];
  return {
    ...a,
    minutesPerDay: clamp(round5(Number(a.minutesPerDay) || 15), 5, 180),
    daysPerWeek: clamp(Math.round(Number(a.daysPerWeek) || 6), 1, 7),
    targetLevel: levelIndex(wanted) < levelIndex(start) ? start : wanted,
    weak: [...new Set(a.weak)]
  };
}

export const suggestedNewPerDay = (minutes: number) => clamp(Math.round(minutes * 0.5), 5, 25);

export function buildStages(a: Answers, today: string): Stage[] {
  const start = NEXT_LEVEL[a.level];
  const perWeekMinutes = a.minutesPerDay * a.daysPerWeek;
  const itemsPerWeek = suggestedNewPerDay(a.minutesPerDay) * a.daysPerWeek;
  const stages: Stage[] = [];
  const upTo = { word: 0, kanji: 0, grammar: 0 };
  let from = today;
  for (let i = levelIndex(start); i <= levelIndex(a.targetLevel); i++) {
    const level = LEVELS[i];
    const info = LEVEL_INFO[level];
    const hoursWeeks = Math.ceil((info.hours * 60) / perWeekMinutes);
    const itemsWeeks = Math.ceil((info.add.word + info.add.kanji + info.add.grammar) / itemsPerWeek);
    const weeks = Math.max(1, hoursWeeks, itemsWeeks);
    upTo.word += info.add.word; upTo.kanji += info.add.kanji; upTo.grammar += info.add.grammar;
    stages.push({ level, weeks, startDate: from, endDate: addDays(from, weeks * 7 - 1), focus: info.focus, add: { ...info.add }, upTo: { ...upTo }, immersion: info.immersion });
    from = addDays(from, weeks * 7);
  }
  return stages;
}

const SERIES: Record<Answers['content'], string[]> = {
  onepiece: ['One Piece'], dgrayman: ['D.Gray-man'], both: ['One Piece', 'D.Gray-man'], other: ['truyện / phim bạn đã nạp']
};

interface Ctx {
  a: Answers; stage: Stage; newPerDay: number; lessons: LessonRef[]; lessonCursor: number; seriesCursor: number; beginner: boolean;
}

const range = ([from, to]: [number, number | null]) => (to === null ? `từ ${from} trở đi` : from === to ? `${from}` : `${from}–${to}`);

function makeTask(id: string, kind: Activity, minutes: number, c: Ctx): Task {
  const base = { id, kind, minutes, link: ACTIVITY_LINK[kind] };
  const level = c.stage.level;
  switch (kind) {
    case 'srs':
      return { ...base, title: 'Ôn thẻ SRS', detail: `Ôn thẻ đến hạn trước, rồi học ${c.newPerDay} thẻ mới. Từ, kanji và ngữ pháp đều nằm trong thẻ.` };
    case 'kanji':
      return { ...base, title: c.beginner ? 'Kana & Kanji' : `Kanji ${level}`,
        detail: c.beginner ? 'Luyện Hiragana, Katakana rồi tập viết vài kanji đơn giản; nghe và nhận diện âm.' : 'Học một nhóm kanji mới theo bộ thủ, xem thứ tự nét và tập viết tay.' };
    case 'grammar':
      return { ...base, title: `Ngữ pháp ${level}`, detail: 'Học 1 đến 2 mẫu câu mới, làm bài điền chỗ trống; mẫu câu được đưa vào SRS để ôn lâu dài.' };
    case 'lesson': {
      const lesson = c.lessons[c.lessonCursor++];
      if (lesson) return { ...base, title: `Bài: ${lesson.title ?? lesson.id}`, detail: 'Làm theo thứ tự trong bài: từ vựng, hội thoại, ngữ pháp rồi bài tập.', lessonId: lesson.id };
      const book = c.a.book === 'any' ? 'giáo trình của bạn' : LABELS.book[c.a.book];
      return { ...base, title: 'Bài giáo trình', detail: `Học bài kế tiếp trong ${book}. Bài sẽ hiện ở đây khi bạn nạp giáo trình.` };
    }
    case 'manga':
    case 'anime': {
      const list = SERIES[c.a.content];
      const series = list[c.seriesCursor++ % list.length];
      const r = c.stage.immersion[kind];
      if (kind === 'manga') {
        const pages = clamp(Math.round(minutes / 3), 2, 20);
        return { ...base, title: `Đọc ${series}`, detail: `Đọc khoảng ${pages} trang (chương ${range(r)} của giai đoạn ${level}). Chạm vào chữ để tra từ, lưu từ mới thành thẻ.` };
      }
      return { ...base, title: `Xem ${series}`, detail: `Xem khoảng ${minutes} phút kèm phụ đề (tập ${range(r)} của giai đoạn ${level}). Chạm vào chữ trong phụ đề để tra, tạo thẻ từ phụ đề.` };
    }
    case 'speaking':
      return { ...base, title: 'Nói với Mochi', detail: 'Nhập vai một tình huống ngắn và nói thành tiếng; Mochi sửa lỗi bằng tiếng Việt, dùng được cả khi không có mạng.' };
  }
}

type Rotating = Exclude<Activity, 'srs'>;

/** Smooth weighted round-robin: kinds appear in proportion to their weight, spread out, never twice in one day. */
function makePicker(weights: Record<Rotating, number>) {
  const kinds = (Object.keys(weights) as Rotating[]).filter((k) => weights[k] > 0);
  const total = kinds.reduce((s, k) => s + weights[k], 0);
  const current = Object.fromEntries(kinds.map((k) => [k, 0])) as Record<Rotating, number>;
  return (taken: Set<Activity>): Rotating | undefined => {
    for (const k of kinds) current[k] += weights[k];
    const options = kinds.filter((k) => !taken.has(k));
    if (!options.length) return undefined;
    const best = options.reduce((x, y) => (current[y] > current[x] ? y : x));
    current[best] -= total;
    return best;
  };
}

export function activityWeights(a: Answers, hasLessons: boolean, signals: Signals = {}): Record<Rotating, number> {
  const w = { ...STYLE_WEIGHT[a.style] };
  for (const [k, v] of Object.entries(GOAL_BOOST[a.goal])) w[k as Rotating] += v;
  for (const p of a.weak) for (const [k, v] of Object.entries(WEAK_BOOST[p])) w[k as Rotating] += v;
  for (const kind of signals.weakKinds ?? []) {
    if (kind === 'kanji') w.kanji += 1; else if (kind === 'grammar') w.grammar += 1;
  }
  if (a.level === 'none') { w.manga *= 0.5; w.anime *= 0.5; w.kanji *= 1.3; }
  if (!hasLessons && a.style !== 'textbook') w.lesson = 0;
  return w;
}

export function buildWeek(a: Answers, stage: Stage, lessons: LessonRef[], signals: Signals = {}): PlanDay[] {
  const study = new Set(STUDY_DAYS[a.daysPerWeek]);
  const share = a.style === 'srs' ? 0.45 : 0.3;
  const srsMin = a.minutesPerDay <= 5 ? a.minutesPerDay : clamp(round5(a.minutesPerDay * share), 5, 25);
  const rest = a.minutesPerDay - srsMin;
  const slots = rest <= 0 ? 0 : rest < 20 ? 1 : rest < 45 ? 2 : 3;
  const units = rest / 5;
  const pick = makePicker(activityWeights(a, lessons.length > 0, signals));
  const ctx: Ctx = { a, stage, newPerDay: suggestedNewPerDay(a.minutesPerDay), lessons, lessonCursor: 0, seriesCursor: 0, beginner: a.level === 'none' };

  return Array.from({ length: 7 }, (_, index) => {
    if (!study.has(index)) return { index, rest: true, tasks: [] };
    const tasks: Task[] = [makeTask(`${index}:0:srs`, 'srs', srsMin, ctx)];
    const taken = new Set<Activity>(['srs']);
    for (let s = 0; s < slots; s++) {
      const kind = pick(taken);
      if (!kind) break;
      taken.add(kind);
      const minutes = (Math.floor(units / slots) + (s < units % slots ? 1 : 0)) * 5;
      tasks.push(makeTask(`${index}:${s + 1}:${kind}`, kind, minutes, ctx));
    }
    // If a day ran out of distinct kinds, hand the unused minutes to the first task so the day still adds up.
    const missing = a.minutesPerDay - tasks.reduce((s, t) => s + t.minutes, 0);
    if (missing > 0) tasks[0].minutes += missing;
    return { index, rest: false, tasks };
  });
}

function buildGoals(a: Answers, stages: Stage[]): RoadGoal[] {
  const first = stages[0];
  const pace = (n: number, weeks: number) => Math.max(1, Math.min(n, Math.round((n / weeks) * 4.3)));
  const monthEnd = addDays(first.startDate, 30);
  const goals: RoadGoal[] = [
    { id: 'days-week', term: 'short', title: `Học đủ ${a.daysPerWeek} ngày trong tuần này`, metric: 'days-week', target: a.daysPerWeek },
    { id: 'minutes-week', term: 'short', title: `Học đủ ${a.minutesPerDay * a.daysPerWeek} phút trong tuần này`, metric: 'minutes-week', target: a.minutesPerDay * a.daysPerWeek },
    { id: 'month-word', term: 'short', title: `Trong 30 ngày: học ${pace(first.add.word, first.weeks)} từ mới`, metric: 'word', target: pace(first.add.word, first.weeks), dueDate: monthEnd },
    { id: 'month-kanji', term: 'short', title: `Trong 30 ngày: học ${pace(first.add.kanji, first.weeks)} kanji`, metric: 'kanji', target: pace(first.add.kanji, first.weeks), dueDate: monthEnd },
    { id: 'month-grammar', term: 'short', title: `Trong 30 ngày: học ${pace(first.add.grammar, first.weeks)} mẫu ngữ pháp`, metric: 'grammar', target: pace(first.add.grammar, first.weeks), dueDate: monthEnd }
  ];
  stages.forEach((s, i) => goals.push({ id: `stage-${s.level}`, term: 'long', title: `Hoàn thành giai đoạn ${s.level}`, metric: 'stage', target: 1, stage: i, dueDate: s.endDate }));
  return goals;
}

export interface GenerateOptions { now?: Date; lessons?: LessonRef[]; signals?: Signals; baseline?: Roadmap['baseline'] }

export function generateRoadmap(raw: Partial<Answers>, opts: GenerateOptions = {}): Roadmap {
  const now = opts.now ?? new Date();
  const a = normalizeAnswers(raw);
  const signals = opts.signals ?? {};
  const today = dateKey(now);
  const startLevel = NEXT_LEVEL[a.level];
  const stages = buildStages(a, today);
  const lessons = pickLessons(opts.lessons ?? [], startLevel, a.book);
  const week = buildWeek(a, stages[0], lessons, signals);
  const totalWeeks = stages.reduce((s, x) => s + x.weeks, 0);

  const tips: string[] = [];
  tips.push(a.minutesPerDay >= 30 ? 'Buổi dài thì chia làm hai lần (sáng và tối) để nhớ lâu hơn.' : 'Ngắn mà đều mỗi ngày tốt hơn học dồn một buổi.');
  if (a.weak.length) tips.push(`Mochi cho thêm thời gian vào: ${a.weak.map((w) => LABELS.weak[w]).join(', ')}.`);
  if (signals.weakKinds?.length) tips.push('Có những mục bạn hay sai trong lúc ôn; lộ trình đã tăng thêm phần kanji và ngữ pháp.');
  if (signals.avgMinutes14 !== undefined && signals.avgMinutes14 < a.minutesPerDay * 0.6) {
    tips.push(`Hai tuần qua bạn học trung bình ${Math.round(signals.avgMinutes14)} phút mỗi ngày, ít hơn kế hoạch ${a.minutesPerDay} phút. Thử giảm xuống ${Math.max(5, round5(signals.avgMinutes14 + 3))} phút để giữ chuỗi ngày học.`);
  }
  if (a.goal === 'anime' || a.goal === 'manga') tips.push('Mỗi lần gặp từ lạ trong truyện hoặc phim, lưu thành thẻ để lần sau nhận ra ngay.');

  return {
    version: 1, generatedAt: now.toISOString(), source: 'rules', answers: a, startLevel, tips,
    summary: `Mục tiêu "${LABELS.goal[a.goal]}": đi từ ${startLevel} đến ${a.targetLevel}, khoảng ${totalWeeks} tuần (${Math.max(1, Math.round(totalWeeks / 4.3))} tháng) nếu học ${a.minutesPerDay} phút × ${a.daysPerWeek} ngày mỗi tuần. Đây là ước lượng, bạn học nhanh hay chậm thì lộ trình sẽ được tính lại.`,
    stages, week, goals: buildGoals(a, stages),
    baseline: opts.baseline ?? signals.learned ?? { word: 0, kanji: 0, grammar: 0 },
    suggest: { srsNewPerDay: suggestedNewPerDay(a.minutesPerDay), goalMinutes: a.minutesPerDay }
  };
}

/** Lessons for the starting level (and book, when known), in book order. Falls back to every lesson. */
export function pickLessons(all: LessonRef[], level: JlptLevel, book: Answers['book']): LessonRef[] {
  const byOrder = (x: LessonRef, y: LessonRef) => (x.order ?? 1e9) - (y.order ?? 1e9);
  const books = book === 'any' ? all : all.filter((l) => !l.book || l.book === book);
  const atLevel = books.filter((l) => l.level === level);
  return [...(atLevel.length ? atLevel : books)].sort(byOrder);
}

export const weekMinutes = (week: PlanDay[]) => week.reduce((s, d) => s + d.tasks.reduce((t, x) => t + x.minutes, 0), 0);

export type WeekEdit =
  | { type: 'rest'; index: number }
  | { type: 'study'; index: number }
  | { type: 'minutes'; taskId: string; delta: number }
  | { type: 'remove'; taskId: string };

/** Hand edits to the weekly schedule. Returns a new roadmap; "regenerate" replaces them with a fresh plan. */
export function editWeek(road: Roadmap, edit: WeekEdit): Roadmap {
  let week = road.week.map((d) => ({ ...d, tasks: d.tasks.map((t) => ({ ...t })) }));
  if (edit.type === 'rest') week = week.map((d) => (d.index === edit.index ? { ...d, rest: true, tasks: [] } : d));
  else if (edit.type === 'study') {
    const model = week.find((d) => !d.rest && d.tasks.length);
    week = week.map((d) => (d.index === edit.index && d.rest
      ? { ...d, rest: false, tasks: (model?.tasks ?? []).map((t) => ({ ...t, id: t.id.replace(/^\d+/, String(edit.index)) })) } : d));
  } else if (edit.type === 'minutes') {
    week = week.map((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === edit.taskId ? { ...t, minutes: clamp(t.minutes + edit.delta, 5, 180) } : t)) }));
  } else {
    week = week.map((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== edit.taskId) }));
  }
  return { ...road, week };
}
