// Data shapes for the community feature (study groups, challenges, leaderboard, feed).
// Everything lives in the `userdata` store under keys `community.*`; nothing here is ever sent
// anywhere by the app itself. Sharing happens only when the learner exports a file (see share.ts).

/** What a leaderboard / challenge counts. */
export type Metric = 'minutes' | 'cards' | 'words' | 'days';

/** What the learner agrees to put into an export. All off until they tick it. */
export interface SharePrefs { minutes: boolean; cards: boolean; words: boolean; streak: boolean }

export const DEFAULT_SHARE: SharePrefs = { minutes: false, cards: false, words: false, streak: false };

/** `community.profile`. `enabled` stays false until the learner opts in. */
export interface Profile { id: string; name: string; enabled: boolean; share: SharePrefs }

/** One day of someone's activity: minutes studied, cards reviewed, new items learned. Missing = not shared. */
export interface DayStat { m?: number; c?: number; w?: number }

/** `community.person:<id>`: me, or a friend whose export I imported. */
export interface Person {
  id: string;
  name: string;
  /** What this person chose to share (so the screen can say "hidden" instead of showing 0). */
  shared: SharePrefs;
  days: Record<string, DayStat>;
  streak?: number;
  /** ms since epoch when the numbers were produced. Newer data replaces older. */
  updatedAt: number;
  /** Sample data from "Xem thử"; never exported. */
  demo?: boolean;
}

/** `community.group:<id>` */
export interface Group {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
}

export type ChallengeKind = 'weekly' | 'monthly' | 'custom';

/** `community.challenge:<id>`. `start` / `end` are local dates `YYYY-MM-DD`, both inclusive. */
export interface Challenge {
  id: string;
  groupId: string;
  title: string;
  kind: ChallengeKind;
  metric: Metric;
  start: string;
  end: string;
  createdAt: number;
  demo?: boolean;
}

export type PostKind = 'streak' | 'progress' | 'words' | 'text';

/** `community.post:<id>`: one entry in a group's feed. */
export interface Post {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  kind: PostKind;
  text: string;
  at: number;
  /** For `words` posts: the new words, as short labels like "猫 (ねこ)". */
  words?: string[];
  /** For `streak` posts. */
  streak?: number;
  demo?: boolean;
}

export const METRIC_LABEL: Record<Metric, string> = {
  minutes: 'Số phút học',
  cards: 'Số thẻ đã ôn',
  words: 'Mục mới học',
  days: 'Số ngày có học'
};
export const METRIC_UNIT: Record<Metric, string> = { minutes: 'phút', cards: 'thẻ', words: 'mục', days: 'ngày' };
