// Static tables behind the generator. Numbers are rough public estimates for each JLPT level
// (words / kanji / grammar points and study hours); the UI says so, and the learner can edit the plan.
import type { Activity, Answers, Book, Content, CurrentLevel, Goal, JlptLevel, LinkTarget, Style, WeakPoint } from './types';

export const NEXT_LEVEL: Record<CurrentLevel, JlptLevel> = { none: 'N5', N5: 'N4', N4: 'N3', N3: 'N2', N2: 'N1' };

/** Items each level adds on top of the one below, and focused study hours needed per level. */
export const LEVEL_INFO: Record<JlptLevel, {
  add: { word: number; kanji: number; grammar: number }; hours: number; focus: string[]; immersion: { manga: [number, number | null]; anime: [number, number | null] };
}> = {
  N5: { add: { word: 800, kanji: 100, grammar: 40 }, hours: 80,
    focus: ['Hiragana, Katakana', 'Câu đơn giản: は, が, を, に', 'Chào hỏi, số đếm, đồ vật quanh bạn'], immersion: { manga: [1, 3], anime: [1, 1] } },
  N4: { add: { word: 700, kanji: 200, grammar: 50 }, hours: 130,
    focus: ['Thể て, thể ない, thể từ điển', 'Nói về sở thích, kế hoạch, lý do', 'Hội thoại hằng ngày chậm'], immersion: { manga: [4, 12], anime: [2, 4] } },
  N3: { add: { word: 2250, kanji: 350, grammar: 70 }, hours: 220,
    focus: ['Thể thông thường, câu phức', 'Đọc đoạn văn ngắn, hiểu ý chính', 'Nghe tốc độ tự nhiên khi có phụ đề'], immersion: { manga: [13, 40], anime: [5, 12] } },
  N2: { add: { word: 2250, kanji: 350, grammar: 80 }, hours: 320,
    focus: ['Kính ngữ, văn viết, tin tức', 'Đọc truyện dài không tra từng chữ', 'Nghe không phụ đề từng đoạn'], immersion: { manga: [41, 100], anime: [13, 30] } },
  N1: { add: { word: 4000, kanji: 1000, grammar: 90 }, hours: 450,
    focus: ['Văn phong trừu tượng, thành ngữ', 'Đọc nguyên tác tự nhiên', 'Xem anime không phụ đề'], immersion: { manga: [101, null], anime: [31, null] } }
};

export const GOAL_DEFAULT_TARGET: Record<Goal, JlptLevel> = { jlpt: 'N5', anime: 'N3', manga: 'N3', conversation: 'N4' };

export const LABELS = {
  level: { none: 'Mới bắt đầu', N5: 'Đã xong N5', N4: 'Đã xong N4', N3: 'Đã xong N3', N2: 'Đã xong N2' } as Record<CurrentLevel, string>,
  goal: { jlpt: 'Thi JLPT', anime: 'Xem anime không phụ đề', manga: 'Đọc manga gốc', conversation: 'Giao tiếp hằng ngày' } as Record<Goal, string>,
  content: { onepiece: 'One Piece', dgrayman: 'D.Gray-man', both: 'Cả hai', other: 'Truyện / phim khác' } as Record<Content, string>,
  weak: { kanji: 'Kanji', vocab: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', reading: 'Đọc', speaking: 'Nói' } as Record<WeakPoint, string>,
  style: { srs: 'Thẻ ôn (SRS)', immersion: 'Xem và đọc nhiều', balanced: 'Cân bằng', textbook: 'Theo giáo trình' } as Record<Style, string>,
  book: { minna: 'Minna no Nihongo', genki: 'Genki', any: 'Chưa chọn' } as Record<Book, string>,
  activity: { srs: 'Ôn thẻ', kanji: 'Kana & Kanji', grammar: 'Ngữ pháp', lesson: 'Bài giáo trình', manga: 'Đọc manga', anime: 'Xem anime', speaking: 'Luyện nói' } as Record<Activity, string>,
  days: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
};

export const ACTIVITY_LINK: Record<Activity, LinkTarget> = {
  srs: 'srs', kanji: 'kanji', grammar: 'srs', lesson: 'lesson', manga: 'manga', anime: 'anime', speaking: 'assistant'
};

/** Which study days to use for N days per week, spread out so rest days are not clumped. */
export const STUDY_DAYS: Record<number, number[]> = {
  1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6]
};

/** Base weight of each non-SRS activity per study style. Higher = shows up more often in the week. */
export const STYLE_WEIGHT: Record<Style, Record<Exclude<Activity, 'srs'>, number>> = {
  srs: { kanji: 2, grammar: 2, lesson: 1, manga: 1, anime: 1, speaking: 0.5 },
  immersion: { kanji: 1, grammar: 1, lesson: 0.5, manga: 3, anime: 3, speaking: 0.5 },
  balanced: { kanji: 1.5, grammar: 1.5, lesson: 1, manga: 2, anime: 2, speaking: 0.7 },
  textbook: { kanji: 1.5, grammar: 2, lesson: 3, manga: 0.7, anime: 0.7, speaking: 1 }
};

export const GOAL_BOOST: Record<Goal, Partial<Record<Exclude<Activity, 'srs'>, number>>> = {
  jlpt: { grammar: 1, lesson: 1, kanji: 0.5 },
  anime: { anime: 2, speaking: 0.5 },
  manga: { manga: 2, kanji: 1 },
  conversation: { speaking: 2, anime: 0.5, grammar: 0.5 }
};

export const WEAK_BOOST: Record<WeakPoint, Partial<Record<Exclude<Activity, 'srs'>, number>>> = {
  kanji: { kanji: 1.5 }, vocab: { manga: 0.5, anime: 0.5 }, grammar: { grammar: 1.5, lesson: 0.5 },
  listening: { anime: 1.5 }, reading: { manga: 1.5 }, speaking: { speaking: 1.5 }
};

/** Describes the answers in a sentence (also what the optional AI step is allowed to see). */
export function describeAnswers(a: Answers): string {
  return [
    `trình độ: ${LABELS.level[a.level]}`, `mục tiêu: ${LABELS.goal[a.goal]} (hướng tới ${a.targetLevel})`,
    `${a.minutesPerDay} phút/ngày, ${a.daysPerWeek} ngày/tuần`, `nội dung yêu thích: ${LABELS.content[a.content]}`,
    `điểm yếu: ${a.weak.length ? a.weak.map((w) => LABELS.weak[w]).join(', ') : 'chưa rõ'}`, `kiểu học: ${LABELS.style[a.style]}`
  ].join('; ');
}
