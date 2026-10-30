<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { Button, ErrorState, Segmented, Skeleton } from '../../lib/ui';
  import { dateKey } from '../progress/stats';
  import { loadOverview } from '../progress/store';
  import ChallengesPanel from './ChallengesPanel.svelte';
  import FeedPanel from './FeedPanel.svelte';
  import GroupsPanel from './GroupsPanel.svelte';
  import LeaderboardPanel from './LeaderboardPanel.svelte';
  import OptIn from './OptIn.svelte';
  import { buildBundle, importBundle, parseBundle, serialize } from './share';
  import {
    addChallenge, addPost, buildMyPerson, clearDemo, createGroup, deleteAllCommunityData, enableCommunity, leaveGroup,
    loadState, recentLearnedLabels, saveProfile, seedDemo, type CommunityState
  } from './store';
  import type { Metric, Person, SharePrefs } from './types';
  import './community.css';

  let { db, onback }: { db: DB; onback: () => void } = $props();

  type Tab = 'groups' | 'challenges' | 'board' | 'feed';
  let tab = $state<Tab>('groups');
  let st = $state.raw<CommunityState>();
  let me = $state.raw<Person>();
  let failed = $state('');
  let selected = $state('');
  let message = $state<{ text: string; ok: boolean }>();
  const today = dateKey(new Date());
  const ALL: SharePrefs = { minutes: true, cards: true, words: true, streak: true };

  async function reload() {
    try {
      st = await loadState(db);
      // My own numbers are always fully visible to me; the share choices only apply to exports.
      me = st.profile?.enabled ? await buildMyPerson(db, st.profile, new Date(), ALL) : undefined;
      if (!st.groups.some((g) => g.id === selected)) selected = st.groups[0]?.id ?? '';
      failed = '';
    } catch (e) { failed = e instanceof Error ? e.message : String(e); }
  }
  onMount(reload);

  const group = $derived(st?.groups.find((g) => g.id === selected));
  const members = $derived.by(() => {
    if (!st || !group || !me) return [];
    return group.memberIds.map((id) => (id === me!.id ? me! : st!.people.get(id))).filter((p): p is Person => !!p);
  });
  const challenges = $derived(st?.challenges.filter((c) => c.groupId === selected) ?? []);
  const posts = $derived(st?.posts.filter((p) => p.groupId === selected) ?? []);
  const tabs: [Tab, string][] = [['groups', 'Nhóm'], ['challenges', 'Thử thách'], ['board', 'Xếp hạng'], ['feed', 'Bảng tin']];
  function say(text: string, ok = true) { message = { text, ok }; }

  async function run(fn: () => Promise<void>) {
    try { await fn(); await reload(); } catch (e) { say(e instanceof Error ? e.message : String(e), false); }
  }

  const enable = (name: string, demo = false) => run(async () => {
    const profile = await enableCommunity(db, name);
    if (demo) await seedDemo(db, profile);
    say(demo ? 'Đã tạo nhóm mẫu với vài người bạn giả để bạn xem thử.' : 'Đã bật cộng đồng. Chưa có gì được chia sẻ.');
  });
  const create = (name: string) => run(async () => {
    const g = await createGroup(db, st!.profile!, name);
    selected = g.id;
    say(`Đã tạo nhóm “${g.name}”. Vào mục “Gửi cho bạn bè” để mời mọi người.`);
  });
  const leave = (id: string) => run(async () => { await leaveGroup(db, id); say('Đã rời nhóm trên máy này.'); });
  const setShare = (share: SharePrefs, name: string) => run(async () => { await saveProfile(db, { ...st!.profile!, name, share }); });
  const wipe = () => run(async () => { await deleteAllCommunityData(db); message = undefined; selected = ''; });

  async function exportGroups(ids: string[], mode: 'file' | 'copy') {
    await run(async () => {
      const bundle = await buildBundle(db, st!.profile!, ids);
      if (mode === 'copy') {
        await navigator.clipboard.writeText(serialize(bundle));
        say('Đã sao chép mã. Dán vào tin nhắn gửi cho bạn bè.');
      } else {
        const url = URL.createObjectURL(new Blob([serialize(bundle, true)], { type: 'application/json' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `yomineko-nhom-${today}.json` });
        a.click();
        URL.revokeObjectURL(url);
        say('Đã tạo file. Gửi file này cho bạn bè qua Zalo, Messenger hoặc email.');
      }
    });
  }

  const importText = (text: string) => run(async () => {
    const r = parseBundle(text);
    if (!r.ok) return say(r.error, false);
    const rep = await importBundle(db, r.bundle, st!.profile!.id);
    selected = r.bundle.groups[0].id;
    say(`Đã nhập: ${rep.groups} nhóm mới, ${rep.people} bạn cập nhật, ${rep.challenges} thử thách, ${rep.posts} bài đăng.`);
  });

  const newChallenge = (kind: 'weekly' | 'monthly', metric: Metric, title: string) => run(async () => { await addChallenge(db, selected, kind, metric, title, today); });
  const post = (text: string) => run(async () => { await addPost(db, st!.profile!, selected, 'text', text); });
  const postStreak = () => run(async () => {
    const ov = await loadOverview(db);
    await addPost(db, st!.profile!, selected, 'streak', ov.streak.current ? 'Mình đang giữ chuỗi học!' : 'Hôm nay mình bắt đầu lại chuỗi học.', { streak: ov.streak.current });
  });
  const postProgress = () => run(async () => {
    const ov = await loadOverview(db);
    const log = ov.logs.get(ov.today);
    await addPost(db, st!.profile!, selected, 'progress', `Hôm nay học ${Math.round((log?.seconds ?? 0) / 60)} phút, ôn ${log?.cards ?? 0} thẻ.`);
  });
  const postWords = () => run(async () => {
    const words = await recentLearnedLabels(db);
    if (!words.length) return say('Tuần này bạn chưa học mục mới nào để chia sẻ.', false);
    await addPost(db, st!.profile!, selected, 'words', 'Từ mới tuần này', { words });
  });
</script>

<div class="cm-stack">
  <header class="top">
    <Button variant="ghost" onclick={onback}>← Quay lại</Button>
    <h1>Cộng đồng <span lang="ja">仲間</span></h1>
  </header>

  {#if failed}
    <ErrorState title="Không mở được cộng đồng" body="Dữ liệu trên máy chưa đọc được. Bạn thử lại nhé." detail={failed}><Button onclick={reload}>Thử lại</Button></ErrorState>
  {:else if !st}
    <Skeleton />
  {:else if !st.profile?.enabled}
    <OptIn onenable={(n) => enable(n)} ondemo={() => enable('Bạn', true)} />
  {:else}
    <Segmented bind:value={tab} options={tabs} label="Mục cộng đồng" />
    {#if tab !== 'groups'}
      {#if st.groups.length > 1}
        <label class="cm-field">Nhóm đang xem
          <select bind:value={selected}>{#each st.groups as g}<option value={g.id}>{g.name}</option>{/each}</select>
        </label>
      {:else if group}
        <p class="cm-muted">Nhóm: <strong>{group.name}</strong></p>
      {/if}
    {/if}

    {#if tab === 'groups'}
      <GroupsPanel profile={st.profile} groups={st.groups} people={st.people} {selected} hasDemo={st.groups.some((g) => g.demo)} {message}
        onselect={(id) => (selected = id)} oncreate={create} onleave={leave} onshare={setShare} onexport={exportGroups}
        onimport={importText} onclearDemo={() => run(async () => { await clearDemo(db); })} onwipe={wipe} />
    {:else if !group || !me}
      <div class="card"><p class="cm-muted">Bạn chưa có nhóm nào. Qua thẻ “Nhóm” để tạo hoặc nhập nhóm.</p></div>
    {:else if tab === 'challenges'}
      <ChallengesPanel {challenges} {me} {today} oncreate={newChallenge} />
    {:else if tab === 'board'}
      <LeaderboardPanel {members} {challenges} myId={st.profile.id} {today} />
    {:else}
      <FeedPanel {posts} myId={st.profile.id} onpost={post} onshareStreak={postStreak} onshareProgress={postProgress} onshareWords={postWords} />
    {/if}
    {#if tab !== 'groups' && message && !message.ok}<p class="cm-note bad" role="alert">{message.text}</p>{/if}
  {/if}
</div>

<style>
  .top { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
  h1 { margin: 0; font-size: var(--text-xl); font-weight: 800; }
</style>
