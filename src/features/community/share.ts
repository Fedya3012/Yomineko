// Export / import format. This is the ONLY way community data leaves or enters the device,
// and it always starts with a button press by the learner. The file is plain JSON they can open and read.
//
// Rules for importing (the file comes from another person, so it is never trusted):
//  - strict shape check, every text is trimmed and length-limited, numbers are clamped;
//  - unknown or newer format versions are refused with a clear message;
//  - newer numbers replace older ones per person; nothing is ever deleted by an import;
//  - an import can never overwrite the learner's own identity or numbers.
import type { DB } from '../../lib/db';
import { isDateKey } from './logic';
import { buildMyPerson, KEYS, loadState, MAX_POST_CHARS, cleanName } from './store';
import type { Challenge, DayStat, Group, Metric, Person, Post, PostKind, Profile, SharePrefs } from './types';

export const FORMAT = 'yomineko-community';
export const VERSION = 1;
export const MAX_BYTES = 512 * 1024;

export interface Bundle {
  format: typeof FORMAT;
  version: number;
  createdAt: number;
  /** Id of the person who made this file. */
  from: string;
  people: Person[];
  groups: Group[];
  challenges: Challenge[];
  posts: Post[];
}

// ---- Export -------------------------------------------------------------------------------

/** Shortest possible description of what a bundle contains, shown to the learner before they send it. */
export function describeShare(share: SharePrefs): string[] {
  const out = ['Tên hiển thị và tên các nhóm bạn chọn'];
  if (share.minutes) out.push('Số phút học mỗi ngày (60 ngày gần nhất)');
  if (share.cards) out.push('Số thẻ ôn mỗi ngày (60 ngày gần nhất)');
  if (share.words) out.push('Số mục mới học mỗi ngày (60 ngày gần nhất)');
  if (share.streak) out.push('Chuỗi ngày học hiện tại');
  if (out.length === 1) out.push('Không có số liệu học nào (bạn chưa tick mục nào)');
  return out;
}

/**
 * Build the file for the chosen groups. Includes the learner's own numbers (only the ticked ones),
 * the groups with their challenges and feed, and the last known numbers of other members of those groups
 * so a group of several people can stay in sync by passing one file around.
 * Sample (demo) data is never included.
 */
export async function buildBundle(db: DB, profile: Profile, groupIds: string[], now = new Date()): Promise<Bundle> {
  const st = await loadState(db);
  const groups = st.groups.filter((g) => !g.demo && groupIds.includes(g.id));
  const ids = new Set(groups.map((g) => g.id));
  const me = await buildMyPerson(db, profile, now);
  const memberIds = new Set(groups.flatMap((g) => g.memberIds));
  const others = [...st.people.values()].filter((p) => p.id !== profile.id && !p.demo && memberIds.has(p.id));
  return {
    format: FORMAT, version: VERSION, createdAt: now.getTime(), from: profile.id,
    people: [me, ...others],
    groups,
    challenges: st.challenges.filter((c) => ids.has(c.groupId) && !c.demo),
    posts: st.posts.filter((p) => ids.has(p.groupId) && !p.demo)
  };
}

export const serialize = (b: Bundle, pretty = false) => JSON.stringify(b, null, pretty ? 2 : undefined);

// ---- Import: validate ---------------------------------------------------------------------

export type ParseResult = { ok: true; bundle: Bundle } | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{3,64}$/;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const num = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : undefined);
const ts = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 8.64e15 ? Math.round(v) : 0);
const METRICS: Metric[] = ['minutes', 'cards', 'words', 'days'];
const POST_KINDS: PostKind[] = ['streak', 'progress', 'words', 'text'];

function readShare(v: unknown): SharePrefs {
  const o = isObj(v) ? v : {};
  return { minutes: o.minutes === true, cards: o.cards === true, words: o.words === true, streak: o.streak === true };
}

function readPerson(v: unknown): Person | undefined {
  if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id) || v.id.startsWith('demo-')) return;
  const shared = readShare(v.shared);
  const days: Record<string, DayStat> = {};
  if (isObj(v.days)) {
    for (const [date, raw] of Object.entries(v.days).slice(0, 400)) {
      if (!isDateKey(date) || !isObj(raw)) continue;
      const d: DayStat = {};
      // Only keep what the person said they share, even if the file contains more.
      const m = num(raw.m, 1440), c = num(raw.c, 5000), w = num(raw.w, 2000);
      if (shared.minutes && m !== undefined) d.m = m;
      if (shared.cards && c !== undefined) d.c = c;
      if (shared.words && w !== undefined) d.w = w;
      if (Object.keys(d).length) days[date] = d;
    }
  }
  const streak = shared.streak ? num(v.streak, 100000) : undefined;
  return { id: v.id, name: cleanName(str(v.name, 40)), shared, days, ...(streak !== undefined ? { streak } : {}), updatedAt: ts(v.updatedAt) };
}

function readGroup(v: unknown): Group | undefined {
  if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id) || v.id.startsWith('demo-')) return;
  const memberIds = Array.isArray(v.memberIds) ? [...new Set(v.memberIds.filter((x): x is string => typeof x === 'string' && ID.test(x)))].slice(0, 200) : [];
  const name = str(v.name, 60);
  if (!name) return;
  return { id: v.id, name, memberIds, createdAt: ts(v.createdAt), updatedAt: ts(v.updatedAt) };
}

function readChallenge(v: unknown, groups: Set<string>): Challenge | undefined {
  if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id) || typeof v.groupId !== 'string' || !groups.has(v.groupId)) return;
  if (!isDateKey(v.start) || !isDateKey(v.end) || v.end < v.start) return;
  if (!METRICS.includes(v.metric as Metric)) return;
  const kind = v.kind === 'weekly' || v.kind === 'monthly' ? v.kind : 'custom';
  const title = str(v.title, 60);
  if (!title) return;
  return { id: v.id, groupId: v.groupId, title, kind, metric: v.metric as Metric, start: v.start, end: v.end, createdAt: ts(v.createdAt) };
}

function readPost(v: unknown, groups: Set<string>): Post | undefined {
  if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id) || typeof v.groupId !== 'string' || !groups.has(v.groupId)) return;
  if (typeof v.authorId !== 'string' || !ID.test(v.authorId) || !POST_KINDS.includes(v.kind as PostKind)) return;
  const words = Array.isArray(v.words) ? v.words.map((w) => str(w, 40)).filter(Boolean).slice(0, 20) : undefined;
  const streak = num(v.streak, 100000);
  return {
    id: v.id, groupId: v.groupId, authorId: v.authorId, authorName: cleanName(str(v.authorName, 40)),
    kind: v.kind as PostKind, text: str(v.text, MAX_POST_CHARS), at: ts(v.at),
    ...(words?.length ? { words } : {}), ...(streak !== undefined ? { streak } : {})
  };
}

/** Check a text pasted or loaded from a file. Returns a cleaned bundle, or a message a non-coder can understand. */
export function parseBundle(text: string): ParseResult {
  if (text.length > MAX_BYTES) return { ok: false, error: 'File quá lớn (hơn 512 KB). Đây có vẻ không phải file chia sẻ của Yomineko.' };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'Không đọc được nội dung này. Hãy dán lại đúng toàn bộ mã bạn bè gửi, hoặc chọn đúng file .json.' }; }
  if (!isObj(raw) || raw.format !== FORMAT) return { ok: false, error: 'Đây không phải file chia sẻ của Yomineko.' };
  if (typeof raw.version !== 'number' || raw.version > VERSION) return { ok: false, error: 'File này được tạo bởi bản Yomineko mới hơn. Hãy cập nhật ứng dụng rồi thử lại.' };
  if (typeof raw.from !== 'string' || !ID.test(raw.from)) return { ok: false, error: 'File thiếu thông tin người gửi nên không dùng được.' };

  const groups = (Array.isArray(raw.groups) ? raw.groups : []).slice(0, 20).map(readGroup).filter((g): g is Group => !!g);
  const gids = new Set(groups.map((g) => g.id));
  if (!groups.length) return { ok: false, error: 'File không chứa nhóm nào.' };
  const people = (Array.isArray(raw.people) ? raw.people : []).slice(0, 200).map(readPerson).filter((p): p is Person => !!p);
  const challenges = (Array.isArray(raw.challenges) ? raw.challenges : []).slice(0, 100).map((c) => readChallenge(c, gids)).filter((c): c is Challenge => !!c);
  const posts = (Array.isArray(raw.posts) ? raw.posts : []).slice(0, 300).map((p) => readPost(p, gids)).filter((p): p is Post => !!p);
  return { ok: true, bundle: { format: FORMAT, version: VERSION, createdAt: ts(raw.createdAt), from: raw.from, people, groups, challenges, posts } };
}

// ---- Import: merge ------------------------------------------------------------------------

export interface ImportReport { groups: number; people: number; challenges: number; posts: number; skippedOld: number }

/** Merge a cleaned bundle into this device. Never deletes, never touches the learner's own person record. */
export async function importBundle(db: DB, bundle: Bundle, myId: string): Promise<ImportReport> {
  const st = await loadState(db);
  const report: ImportReport = { groups: 0, people: 0, challenges: 0, posts: 0, skippedOld: 0 };
  const tx = db.transaction('userdata', 'readwrite');

  const groups = new Map(st.groups.map((g) => [g.id, g]));
  for (const g of bundle.groups) {
    const old = groups.get(g.id);
    // I join the group by importing it. Members are merged, the newer name wins.
    const members = [...new Set([...(old?.memberIds ?? []), ...g.memberIds, bundle.from, myId])];
    const merged: Group = { ...(old && old.updatedAt >= g.updatedAt ? old : g), memberIds: members, createdAt: old?.createdAt ?? g.createdAt };
    tx.store.put(merged, KEYS.group(g.id));
    if (!old) report.groups++;
  }
  for (const p of bundle.people) {
    if (p.id === myId) continue;
    const old = st.people.get(p.id);
    if (old && old.updatedAt >= p.updatedAt) { report.skippedOld++; continue; }
    tx.store.put(p, KEYS.person(p.id));
    report.people++;
  }
  const knownChallenges = new Set(st.challenges.map((c) => c.id));
  for (const c of bundle.challenges) {
    if (knownChallenges.has(c.id)) continue;
    tx.store.put(c, KEYS.challenge(c.id));
    report.challenges++;
  }
  const knownPosts = new Set(st.posts.map((p) => p.id));
  for (const p of bundle.posts) {
    if (knownPosts.has(p.id)) continue;
    tx.store.put(p, KEYS.post(p.id));
    report.posts++;
  }
  await tx.done;
  return report;
}
