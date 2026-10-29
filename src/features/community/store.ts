// Reads and writes community data. Only the `userdata` store is touched (keys `community.*`).
import type { DB } from '../../lib/db';
import { dateKey } from '../progress/stats';
import { loadLearned, loadLogs, loadOverview } from '../progress/store';
import { addDays, newChallenge, newId } from './logic';
import {
  DEFAULT_SHARE, type Challenge, type DayStat, type Group, type Metric, type Person, type Post, type PostKind, type Profile, type SharePrefs
} from './types';

export const KEYS = {
  profile: 'community.profile',
  group: (id: string) => `community.group:${id}`,
  challenge: (id: string) => `community.challenge:${id}`,
  person: (id: string) => `community.person:${id}`,
  post: (id: string) => `community.post:${id}`
} as const;
const PREFIXES = ['group', 'challenge', 'person', 'post'].map((n) => `community.${n}:`);

/** How many days of history go into an export. */
export const EXPORT_DAYS = 60;
export const MAX_POST_CHARS = 280;

export interface CommunityState {
  profile?: Profile;
  groups: Group[];
  challenges: Challenge[];
  people: Map<string, Person>;
  posts: Post[];
}

async function loadPrefix<T>(db: DB, prefix: string): Promise<T[]> {
  return (await db.getAll('userdata', IDBKeyRange.bound(prefix, prefix + '￿'))) as T[];
}

export async function loadProfile(db: DB): Promise<Profile | undefined> {
  const p = (await db.get('userdata', KEYS.profile)) as Profile | undefined;
  return p && { ...p, share: { ...DEFAULT_SHARE, ...p.share } };
}

export async function loadState(db: DB): Promise<CommunityState> {
  const [profile, groups, challenges, people, posts] = await Promise.all([
    loadProfile(db),
    loadPrefix<Group>(db, PREFIXES[0]),
    loadPrefix<Challenge>(db, PREFIXES[1]),
    loadPrefix<Person>(db, PREFIXES[2]),
    loadPrefix<Post>(db, PREFIXES[3])
  ]);
  return {
    profile,
    groups: groups.sort((a, b) => a.createdAt - b.createdAt),
    challenges: challenges.sort((a, b) => b.start.localeCompare(a.start)),
    people: new Map(people.map((p) => [p.id, p])),
    posts: posts.sort((a, b) => b.at - a.at)
  };
}

/** Opt in: nothing is shared by this alone, it only creates a local identity. */
export async function enableCommunity(db: DB, name: string): Promise<Profile> {
  const old = await loadProfile(db);
  const profile: Profile = { id: old?.id ?? newId('u'), name: cleanName(name), enabled: true, share: old?.share ?? { ...DEFAULT_SHARE } };
  await db.put('userdata', profile, KEYS.profile);
  return profile;
}

export async function saveProfile(db: DB, p: Profile): Promise<void> {
  await db.put('userdata', { ...p, name: cleanName(p.name) }, KEYS.profile);
}

export const cleanName = (s: string, max = 40) => s.replace(/\s+/g, ' ').trim().slice(0, max) || 'Bạn học';

/** Numbers from the progress feature, cut down to what `share` allows. Only the last EXPORT_DAYS days. */
export async function buildMyPerson(db: DB, profile: Profile, now = new Date(), share: SharePrefs = profile.share): Promise<Person> {
  const today = dateKey(now);
  const from = addDays(today, -(EXPORT_DAYS - 1));
  const [logs, learned, ov] = await Promise.all([loadLogs(db), loadLearned(db), loadOverview(db, now)]);
  const newByDay = new Map<string, number>();
  for (const kind of Object.values(learned)) for (const date of Object.values(kind)) newByDay.set(date, (newByDay.get(date) ?? 0) + 1);

  const days: Record<string, DayStat> = {};
  const dates = new Set([...logs.keys(), ...newByDay.keys()]);
  for (const date of dates) {
    if (date < from || date > today) continue;
    const log = logs.get(date);
    const d: DayStat = {};
    if (share.minutes) d.m = Math.round((log?.seconds ?? 0) / 60);
    if (share.cards) d.c = log?.cards ?? 0;
    if (share.words) d.w = newByDay.get(date) ?? 0;
    if (Object.keys(d).length) days[date] = d;
  }
  return {
    id: profile.id, name: profile.name, shared: { ...share }, days,
    ...(share.streak ? { streak: ov.streak.current } : {}),
    updatedAt: now.getTime()
  };
}

export async function createGroup(db: DB, profile: Profile, name: string, now = Date.now()): Promise<Group> {
  const g: Group = { id: newId('g'), name: cleanName(name, 60), memberIds: [profile.id], createdAt: now, updatedAt: now };
  await db.put('userdata', g, KEYS.group(g.id));
  return g;
}

/** Leave a group on this device: removes the group, its challenges and feed. Other people's data is kept only while some group still lists them. */
export async function leaveGroup(db: DB, groupId: string): Promise<void> {
  const st = await loadState(db);
  const tx = db.transaction('userdata', 'readwrite');
  tx.store.delete(KEYS.group(groupId));
  for (const c of st.challenges) if (c.groupId === groupId) tx.store.delete(KEYS.challenge(c.id));
  for (const p of st.posts) if (p.groupId === groupId) tx.store.delete(KEYS.post(p.id));
  const stillUsed = new Set(st.groups.filter((g) => g.id !== groupId).flatMap((g) => g.memberIds));
  for (const id of st.people.keys()) if (id !== st.profile?.id && !stillUsed.has(id)) tx.store.delete(KEYS.person(id));
  await tx.done;
}

export async function addChallenge(db: DB, groupId: string, kind: 'weekly' | 'monthly', metric: Metric, title: string, today = dateKey(new Date())): Promise<Challenge> {
  const c = newChallenge(groupId, kind, metric, today, newId('c'), Date.now(), title);
  await db.put('userdata', c, KEYS.challenge(c.id));
  return c;
}

export async function addPost(db: DB, profile: Profile, groupId: string, kind: PostKind, text: string, extra: { words?: string[]; streak?: number } = {}, now = Date.now()): Promise<Post> {
  const post: Post = {
    id: newId('p'), groupId, authorId: profile.id, authorName: profile.name, kind, at: now,
    text: text.trim().slice(0, MAX_POST_CHARS),
    ...(extra.words ? { words: extra.words.slice(0, 20) } : {}),
    ...(extra.streak !== undefined ? { streak: extra.streak } : {})
  };
  await db.put('userdata', post, KEYS.post(post.id));
  return post;
}

/** Labels of items learned in the last `days` days, newest first (for a "new words" post). */
export async function recentLearnedLabels(db: DB, days = 7, now = new Date()): Promise<string[]> {
  const today = dateKey(now);
  const from = addDays(today, -(days - 1));
  const [learned, logs] = await Promise.all([loadLearned(db), loadLogs(db)]);
  const out: { date: string; label: string }[] = [];
  for (const kind of ['word', 'kanji', 'grammar'] as const) {
    for (const [id, date] of Object.entries(learned[kind])) {
      if (date < from || date > today) continue;
      const label = logs.get(date)?.items[`${kind}:${id}`]?.label;
      if (label) out.push({ date, label });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).map((x) => x.label);
}

/** Wipe every community key on this device (progress and SRS are untouched). */
export async function deleteAllCommunityData(db: DB): Promise<void> {
  const tx = db.transaction('userdata', 'readwrite');
  tx.store.delete(KEYS.profile);
  for (const prefix of PREFIXES) tx.store.delete(IDBKeyRange.bound(prefix, prefix + '￿'));
  await tx.done;
}

// ---- Demo data ("Xem thử") ----------------------------------------------------------------

const DEMO_PEOPLE = [
  { id: 'demo-mai', name: 'Mai', base: 22 }, { id: 'demo-linh', name: 'Linh', base: 15 },
  { id: 'demo-hana', name: 'Hana', base: 28 }, { id: 'demo-ken', name: 'Ken', base: 9 }
];

/** Sample group with made-up friends so the screens can be tried without anyone else. Marked `demo` and never exported. */
export async function seedDemo(db: DB, profile: Profile, now = new Date()): Promise<void> {
  const today = dateKey(now);
  const at = now.getTime();
  const group: Group = { id: 'demo-g-sakura', name: 'Nhóm Sakura (mẫu)', memberIds: [profile.id, ...DEMO_PEOPLE.map((p) => p.id)], createdAt: at, updatedAt: at, demo: true };
  const tx = db.transaction('userdata', 'readwrite');
  tx.store.put(group, KEYS.group(group.id));
  DEMO_PEOPLE.forEach((p, pi) => {
    const days: Record<string, DayStat> = {};
    for (let i = 0; i < 35; i++) {
      const wave = (i * 7 + pi * 5) % 11; // deterministic "random"
      if (wave < 2) continue; // rest days
      days[addDays(today, -i)] = { m: p.base + wave, c: (p.base + wave) * 2, w: wave % 4 };
    }
    const person: Person = { id: p.id, name: p.name, shared: { minutes: true, cards: true, words: true, streak: true }, days, streak: 3 + pi * 4, updatedAt: at, demo: true };
    tx.store.put(person, KEYS.person(p.id));
  });
  const week = newChallenge(group.id, 'weekly', 'minutes', today, 'demo-c-week', at, 'Tuần này học bao nhiêu phút?');
  const month = newChallenge(group.id, 'monthly', 'cards', today, 'demo-c-month', at, 'Thử thách ôn thẻ tháng này');
  tx.store.put({ ...week, demo: true }, KEYS.challenge(week.id));
  tx.store.put({ ...month, demo: true }, KEYS.challenge(month.id));
  const posts: Post[] = [
    { id: 'demo-p1', groupId: group.id, authorId: 'demo-hana', authorName: 'Hana', kind: 'streak', text: 'Chuỗi 15 ngày rồi, không bỏ ngày nào!', streak: 15, at: at - 3600e3 },
    { id: 'demo-p2', groupId: group.id, authorId: 'demo-mai', authorName: 'Mai', kind: 'words', text: 'Từ mới tuần này', words: ['猫 (ねこ)', '図書館 (としょかん)', '勉強 (べんきょう)'], at: at - 5 * 3600e3 },
    { id: 'demo-p3', groupId: group.id, authorId: 'demo-ken', authorName: 'Ken', kind: 'text', text: 'Ai học Genki bài 5 chưa? Mình hay nhầm trợ từ に và で.', at: at - 26 * 3600e3 },
    { id: 'demo-p4', groupId: group.id, authorId: 'demo-linh', authorName: 'Linh', kind: 'progress', text: 'Hôm nay học 25 phút, ôn 60 thẻ.', at: at - 30 * 3600e3 }
  ];
  for (const p of posts) tx.store.put({ ...p, demo: true }, KEYS.post(p.id));
  await tx.done;
}

export async function clearDemo(db: DB): Promise<void> {
  const st = await loadState(db);
  const tx = db.transaction('userdata', 'readwrite');
  for (const g of st.groups) if (g.demo) tx.store.delete(KEYS.group(g.id));
  for (const c of st.challenges) if (c.demo) tx.store.delete(KEYS.challenge(c.id));
  for (const p of st.posts) if (p.demo) tx.store.delete(KEYS.post(p.id));
  for (const p of st.people.values()) if (p.demo) tx.store.delete(KEYS.person(p.id));
  await tx.done;
}
