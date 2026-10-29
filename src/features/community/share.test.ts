import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, type DB } from '../../lib/db';
import { recordSession } from '../progress/store';
import { buildBundle, describeShare, FORMAT, importBundle, parseBundle, serialize, VERSION } from './share';
import {
  addChallenge, addPost, clearDemo, createGroup, deleteAllCommunityData, enableCommunity, leaveGroup, loadState, saveProfile, seedDemo
} from './store';
import { leaderboard, weekRange } from './logic';

let n = 0;
async function newDevice() { return openDatabase(`community-test-${n++}`); }
const at = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
const NOW = new Date('2026-10-29T12:00:00');

async function study(db: DB, iso: string, seconds: number, ok = 3) {
  await recordSession(db, {
    endedAt: at(iso), seconds, source: 'SRS',
    items: Array.from({ length: ok }, (_, i) => ({ kind: 'word' as const, id: `${iso}-${i}`, label: `語${i}`, correct: true, learned: true }))
  });
}

let a: DB, b: DB;
beforeEach(async () => { a = await newDevice(); b = await newDevice(); });

describe('opt-in', () => {
  it('stores nothing and shares nothing until the learner enables it', async () => {
    const st = await loadState(a);
    expect(st.profile).toBeUndefined();
    expect(st.groups).toEqual([]);
  });
  it('enabling creates an identity with every sharing option OFF', async () => {
    const p = await enableCommunity(a, '  Mai  ');
    expect(p.name).toBe('Mai');
    expect(p.share).toEqual({ minutes: false, cards: false, words: false, streak: false });
    expect(describeShare(p.share).join(' ')).toContain('Không có số liệu học nào');
    // Enabling again keeps the same identity.
    expect((await enableCommunity(a, 'Mai 2')).id).toBe(p.id);
  });
});

describe('export', () => {
  it('contains only the numbers the learner ticked', async () => {
    const me = await enableCommunity(a, 'Mai');
    await study(a, '2026-10-28', 1200);
    const g = await createGroup(a, me, 'Nhóm N5');

    let bundle = await buildBundle(a, me, [g.id], NOW);
    expect(bundle.people[0].days).toEqual({});
    expect(bundle.people[0].streak).toBeUndefined();

    await saveProfile(a, { ...me, share: { minutes: true, cards: false, words: false, streak: false } });
    bundle = await buildBundle(a, { ...me, share: { minutes: true, cards: false, words: false, streak: false } }, [g.id], NOW);
    expect(bundle.people[0].days['2026-10-28']).toEqual({ m: 20 });
    expect(JSON.stringify(bundle)).not.toContain('語'); // word labels never leave unless posted
  });
  it('includes streak, cards and new-item counts when ticked, and only the last 60 days', async () => {
    const me = { ...(await enableCommunity(a, 'Mai')), share: { minutes: true, cards: true, words: true, streak: true } };
    await study(a, '2026-10-29', 600, 2);
    await study(a, '2026-07-01', 600, 1); // too old
    const g = await createGroup(a, me, 'G');
    const { people } = await buildBundle(a, me, [g.id], NOW);
    expect(people[0].days).toEqual({ '2026-10-29': { m: 10, c: 2, w: 2 } });
    expect(people[0].streak).toBe(1);
  });
  it('never exports demo data or groups that were not chosen', async () => {
    const me = await enableCommunity(a, 'Mai');
    await seedDemo(a, me, NOW);
    const real = await createGroup(a, me, 'Thật');
    const other = await createGroup(a, me, 'Khác');
    const bundle = await buildBundle(a, me, ['demo-g-sakura', real.id], NOW);
    expect(bundle.groups.map((g) => g.id)).toEqual([real.id]);
    expect(bundle.people.map((p) => p.id)).toEqual([me.id]);
    expect(bundle.challenges).toEqual([]);
    expect(bundle.groups.some((g) => g.id === other.id)).toBe(false);
  });
});

describe('round trip between two devices', () => {
  it('lets a friend join the group and see the numbers, challenges and feed', async () => {
    const mai = { ...(await enableCommunity(a, 'Mai')), share: { minutes: true, cards: false, words: false, streak: true } };
    await study(a, '2026-10-28', 1800);
    const g = await createGroup(a, mai, 'Nhóm N5');
    await addChallenge(a, g.id, 'weekly', 'minutes', 'Tuần vui', '2026-10-29');
    await addPost(a, mai, g.id, 'text', 'Chào cả nhà');
    const file = serialize(await buildBundle(a, mai, [g.id], NOW));

    const lan = await enableCommunity(b, 'Lan');
    const parsed = parseBundle(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const report = await importBundle(b, parsed.bundle, lan.id);
    expect(report).toMatchObject({ groups: 1, people: 1, challenges: 1, posts: 1 });

    const st = await loadState(b);
    expect(st.groups[0].memberIds).toEqual(expect.arrayContaining([mai.id, lan.id]));
    const rows = leaderboard([st.people.get(mai.id)!], 'minutes', weekRange('2026-10-29'));
    expect(rows[0].score).toBe(30);
    expect(st.challenges[0].title).toBe('Tuần vui');
    expect(st.posts[0].text).toBe('Chào cả nhà');
  });
  it('importing twice changes nothing, and older numbers never replace newer ones', async () => {
    const mai = { ...(await enableCommunity(a, 'Mai')), share: { minutes: true, cards: false, words: false, streak: false } };
    const g = await createGroup(a, mai, 'G');
    await study(a, '2026-10-28', 600);
    const older = (await buildBundle(a, mai, [g.id], new Date('2026-10-29T08:00:00')));
    await study(a, '2026-10-28', 600);
    const newer = (await buildBundle(a, mai, [g.id], new Date('2026-10-29T20:00:00')));

    const lan = await enableCommunity(b, 'Lan');
    await importBundle(b, newer, lan.id);
    const again = await importBundle(b, newer, lan.id);
    expect(again).toMatchObject({ groups: 0, people: 0, challenges: 0, posts: 0 });
    await importBundle(b, older, lan.id);
    expect((await loadState(b)).people.get(mai.id)!.days['2026-10-28'].m).toBe(20);
  });
  it('relays other members so a group of three stays in sync through one file', async () => {
    const c = await newDevice();
    const mai = { ...(await enableCommunity(a, 'Mai')), share: { minutes: true, cards: false, words: false, streak: false } };
    await study(a, '2026-10-28', 600);
    const g = await createGroup(a, mai, 'G');
    const lan = { ...(await enableCommunity(b, 'Lan')), share: { minutes: true, cards: false, words: false, streak: false } };
    await importBundle(b, await buildBundle(a, mai, [g.id], NOW), lan.id);
    await study(b, '2026-10-28', 1200);
    const viaLan = await buildBundle(b, lan, [g.id], NOW);
    const hoa = await enableCommunity(c, 'Hoa');
    await importBundle(c, viaLan, hoa.id);
    const st = await loadState(c);
    expect([...st.people.keys()].sort()).toEqual([lan.id, mai.id].sort());
  });
  it('never lets an import overwrite my own numbers', async () => {
    const mai = await enableCommunity(a, 'Mai');
    const g = await createGroup(a, mai, 'G');
    const bundle = await buildBundle(a, mai, [g.id], NOW);
    bundle.people[0].name = 'Kẻ giả mạo';
    await importBundle(a, bundle, mai.id);
    expect((await loadState(a)).people.has(mai.id)).toBe(false);
  });
});

describe('parseBundle refuses bad input with a readable message', () => {
  const good = () => ({
    format: FORMAT, version: VERSION, createdAt: 1, from: 'u-abc123',
    people: [{ id: 'u-abc123', name: 'Mai', shared: { minutes: true }, days: { '2026-10-28': { m: 20, c: 500 } }, updatedAt: 1 }],
    groups: [{ id: 'g-abc123', name: 'Nhóm', memberIds: ['u-abc123'], createdAt: 1, updatedAt: 1 }],
    challenges: [], posts: []
  });
  const text = (o: unknown) => JSON.stringify(o);

  it('accepts a good file', () => { expect(parseBundle(text(good())).ok).toBe(true); });
  it('rejects non-JSON, other formats, and newer versions', () => {
    expect(parseBundle('hello')).toMatchObject({ ok: false });
    expect(parseBundle(text({ ...good(), format: 'other' }))).toMatchObject({ ok: false });
    const newer = parseBundle(text({ ...good(), version: VERSION + 1 }));
    expect(newer.ok === false && newer.error).toContain('mới hơn');
  });
  it('rejects oversized input', () => { expect(parseBundle('x'.repeat(600 * 1024))).toMatchObject({ ok: false }); });
  it('requires at least one valid group', () => { expect(parseBundle(text({ ...good(), groups: [] }))).toMatchObject({ ok: false }); });
  it('drops numbers the person did not agree to share, and clamps absurd values', () => {
    const f = good();
    (f.people[0].days['2026-10-28'] as Record<string, number>).m = 999999;
    const r = parseBundle(text(f));
    if (!r.ok) throw new Error(r.error);
    expect(r.bundle.people[0].days['2026-10-28']).toEqual({ m: 1440 }); // cards were not shared → removed
  });
  it('cleans names and text, and skips malformed items instead of failing everything', () => {
    const f = good() as Record<string, unknown>;
    f.people = [...(f.people as unknown[]), { id: '../etc', name: 'x' }, { id: 'demo-fake', name: 'x' }, 5];
    f.posts = [
      { id: 'p-1234', groupId: 'g-abc123', authorId: 'u-abc123', authorName: '  <b>Mai</b>\n\n', kind: 'text', text: 'a'.repeat(1000), at: 1 },
      { id: 'p-9999', groupId: 'g-unknown', authorId: 'u-abc123', kind: 'text', text: 'x', at: 1 },
      { id: 'p-8888', groupId: 'g-abc123', authorId: 'u-abc123', kind: 'script', text: 'x', at: 1 }
    ];
    f.challenges = [
      { id: 'c-1234', groupId: 'g-abc123', title: 'Tuần', kind: 'weekly', metric: 'minutes', start: '2026-10-26', end: '2026-11-01' },
      { id: 'c-5678', groupId: 'g-abc123', title: 'Ngược', kind: 'weekly', metric: 'minutes', start: '2026-11-01', end: '2026-10-26' },
      { id: 'c-9999', groupId: 'g-abc123', title: 'Sai', kind: 'weekly', metric: 'gold', start: '2026-10-26', end: '2026-11-01' }
    ];
    const r = parseBundle(text(f));
    if (!r.ok) throw new Error(r.error);
    expect(r.bundle.people.map((p) => p.id)).toEqual(['u-abc123']);
    expect(r.bundle.posts).toHaveLength(1);
    expect(r.bundle.posts[0].text).toHaveLength(280);
    expect(r.bundle.posts[0].authorName).toBe('<b>Mai</b>'); // kept as plain text; Svelte escapes it when shown
    expect(r.bundle.challenges.map((c) => c.id)).toEqual(['c-1234']);
  });
});

describe('leaving, demo and wiping', () => {
  it('leaving a group removes its challenges, feed and members only that group used', async () => {
    const mai = await enableCommunity(a, 'Mai');
    const g1 = await createGroup(a, mai, 'G1');
    const bundle = await buildBundle(a, { ...mai, id: 'u-friend01', name: 'Bạn' }, [g1.id], NOW);
    // Pretend a friend's file brought a second group.
    bundle.groups = [{ ...bundle.groups[0], id: 'g-other01', name: 'G2', memberIds: ['u-friend01'] }];
    bundle.people[0].shared.minutes = true;
    await importBundle(a, bundle, mai.id);
    await addPost(a, mai, g1.id, 'text', 'hi');
    await leaveGroup(a, 'g-other01');
    const st = await loadState(a);
    expect(st.groups.map((g) => g.id)).toEqual([g1.id]);
    expect(st.people.has('u-friend01')).toBe(false);
    expect(st.posts).toHaveLength(1);
  });
  it('demo data can be cleared without touching real groups; wipe removes all community keys but not progress', async () => {
    const mai = await enableCommunity(a, 'Mai');
    await study(a, '2026-10-28', 600);
    await seedDemo(a, mai, NOW);
    await createGroup(a, mai, 'Thật');
    expect((await loadState(a)).people.size).toBe(4);
    await clearDemo(a);
    const st = await loadState(a);
    expect(st.groups.map((g) => g.name)).toEqual(['Thật']);
    expect(st.people.size).toBe(0);
    expect(st.posts).toEqual([]);
    await deleteAllCommunityData(a);
    expect((await loadState(a)).profile).toBeUndefined();
    expect(await a.get('userdata', 'progress.learned')).toBeTruthy();
  });
});
