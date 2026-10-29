<script lang="ts">
  import { onMount } from 'svelte';
  import { applySettings, loadSettings, saveSettings, type Settings, type ThemeChoice } from './lib/settings';
  import { openDatabase, listCollection, type DB } from './lib/db';
  import { installPack } from './lib/packs/install';
  import Badge from './lib/Badge.svelte';
  import DictionaryPanel from './features/dictionary/DictionaryPanel.svelte';
  import WordPopup from './features/dictionary/WordPopup.svelte';
  import TextbookView from './features/textbook/TextbookView.svelte';
  import KanaKanjiApp from './features/kana-kanji/KanaKanjiApp.svelte';
  import UpdateCenter from './features/updates/UpdateCenter.svelte';
  import Assistant from './features/assistant/Assistant.svelte';
  import AnimePlayer from './features/anime/AnimePlayer.svelte';
  import MangaReader from './features/manga/MangaReader.svelte';
  import SrsHome from './features/srs/SrsHome.svelte';
  import ProgressView from './features/progress/ProgressView.svelte';
  import InsightsView from './features/insights/InsightsView.svelte';
  import { recordSession } from './features/progress/store';
  import Onboarding from './features/roadmap/Onboarding.svelte';
  import RoadmapView from './features/roadmap/RoadmapView.svelte';
  import TodayCard from './features/roadmap/TodayCard.svelte';
  import { isSkipped, loadRoadmap } from './features/roadmap/store';
  import type { LinkTarget } from './features/roadmap/types';
  import type { SessionSummary } from './features/progress/types';
  import demoPack from '../packs-src/demo-words/v1.json';

  let settings = $state<Settings>(loadSettings());
  let db: DB | undefined;
  let readyDb = $state.raw<DB>();
  let lastSummary = $state<SessionSummary>();
  let progressKey = $state(0);
  let words = $state<{ id: string; kanji: string; reading: string; meaning: string }[]>([]);
  let status = $state('');
  let view = $state<'home' | 'anime' | 'kana' | 'manga' | 'textbooks' | 'roadmap' | 'onboarding'>('home');
  let roadmapKey = $state(0);

  // Feature areas. Each later thread replaces its placeholder card with a real screen.
  const features = [
    { tone: 'sky', name: 'Lộ trình', note: 'Đã có', d: 'M20 78c22 0 8-28 30-28s8-28 30-28M20 78h.1M80 22h.1' },
    { tone: 'coral', name: 'Ôn tập SRS', note: 'Đã có', d: 'M20 30h60v40H20zM30 20h40M35 45h30M35 58h18' },
    { tone: 'teal', name: 'Từ điển', note: 'Ở bên dưới ↓', d: 'M50 28C40 20 25 20 15 26v50c10-6 25-6 35 2 10-8 25-8 35-2V26C75 20 60 20 50 28zM50 28v50' },
    { tone: 'mint', name: 'Kana & Kanji', note: 'Thread Kana/Kanji', d: 'M25 35h50M50 20v60M32 55c10 4 22 4 32 0M40 70c6 6 14 6 20 0' },
    { tone: 'sky', name: 'Đọc manga', note: 'Thread Manga', d: 'M20 20h60v60H20zM20 50h60M50 20v30M50 50v30' },
    { tone: 'coral', name: 'Xem anime', note: 'Thread Anime', d: 'M20 28h60v44H20zM42 40l20 10-20 10z' },
    { tone: 'mint', name: 'Tiến độ', note: 'Thread Tiến độ', d: 'M18 78V22M18 78h64M28 62l16-16 12 10 22-26' }
  ] as const;

  $effect(() => { applySettings(settings); saveSettings(settings); });

  async function refresh() {
    words = (await listCollection(db!, 'words')) as typeof words;
  }

  onMount(async () => {
    db = await openDatabase();
    readyDb = db;
    await refresh();
    // First launch: ask the onboarding questions once (unless the learner skipped them).
    if (!(await loadRoadmap(db)) && !(await isSkipped(db))) view = 'onboarding';
  });

  // Roadmap tasks open the matching screen.
  const homeAnchors: Partial<Record<LinkTarget, string>> = { srs: 'sec-srs', dictionary: 'sec-dictionary', assistant: 'sec-assistant', progress: 'sec-progress' };
  function openTarget(target: LinkTarget): string | void {
    const screens: Partial<Record<LinkTarget, typeof view>> = { anime: 'anime', kanji: 'kana', manga: 'manga', lesson: 'textbooks' };
    const screen = screens[target];
    if (screen) { view = screen; return; }
    const anchor = homeAnchors[target];
    if (!anchor) return 'Không mở được màn hình này.';
    view = 'home';
    setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function loadDemo() {
    try {
      await installPack(db!, demoPack);
      status = 'Đã cài gói mẫu ✔';
    } catch (e) {
      status = e instanceof Error ? e.message : String(e);
    }
    await refresh();
  }

  // Demo only: the SRS thread will call recordSession itself when a real session ends.
  async function demoSession() {
    lastSummary = await recordSession(db!, {
      endedAt: Date.now(), seconds: 420, source: 'Học thử',
      items: [
        { kind: 'word', id: 'neko', label: '猫 (ねこ)', correct: true, learned: true },
        { kind: 'word', id: 'inu', label: '犬 (いぬ)', correct: false },
        { kind: 'kanji', id: '本', label: '本', correct: true, learned: true },
        { kind: 'grammar', id: 'wa', label: 'は (chủ đề)', correct: true }
      ]
    });
    progressKey++;
  }

  const themes: [ThemeChoice, string][] = [['system', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']];
</script>

<main>
  {#if view === 'textbooks'}
    {#if readyDb}<TextbookView db={readyDb} onback={() => (view = 'home')} />{:else}<p class="muted">Đang mở kho dữ liệu…</p>{/if}
  {:else if view === 'kana'}
    <KanaKanjiApp onback={() => (view = 'home')} />
  {:else if view === 'manga' && readyDb}
    <MangaReader db={readyDb} onBack={() => (view = 'home')} />
  {:else if view === 'anime' && readyDb}
    <AnimePlayer db={readyDb} onclose={() => (view = 'home')} />
  {:else if view === 'onboarding' && readyDb}
    <Onboarding db={readyDb} ondone={() => { roadmapKey++; view = 'roadmap'; }} oncancel={() => { roadmapKey++; view = 'home'; }} />
  {:else if view === 'roadmap' && readyDb}
    <RoadmapView db={readyDb} onclose={() => (view = 'home')} onopen={openTarget} onchange={() => roadmapKey++} />
  {:else}
  <header>
    <img src="favicon.svg" alt="Mochi, chú mèo trắng" width="56" height="56" />
    <div>
      <h1>Yomineko <span lang="ja">読み猫</span></h1>
      <p class="muted">Học tiếng Nhật qua manga và anime cùng Mochi</p>
    </div>
  </header>

  {#if readyDb}<UpdateCenter db={readyDb} onContentChanged={refresh} />{/if}
  {#if readyDb}<TodayCard db={readyDb} refreshKey={roadmapKey + progressKey} onview={() => (view = 'roadmap')} oncreate={() => (view = 'onboarding')} />{/if}
  <div id="sec-srs">{#if readyDb}<SrsHome db={readyDb} onsession={(s) => { lastSummary = s; progressKey++; }} />{/if}</div>

  <section class="card hero" aria-label="Học theo giáo trình">
    <Badge tone="coral" size={72}><svg viewBox="0 0 100 100"><path d="M22 20h46a10 10 0 0 1 10 10v50H32a10 10 0 0 1-10-10zM22 70a10 10 0 0 1 10-10h46M38 36h26M38 48h18" /></svg></Badge>
    <div class="hero-text">
      <h2 class="section-title">Học theo giáo trình</h2>
      <p class="muted">Minna no Nihongo, Genki… Học lần lượt từng bài: từ vựng, ngữ pháp, hội thoại, bài tập.</p>
    </div>
    <button class="btn" onclick={() => (view = 'textbooks')}>Mở giáo trình</button>
  </section>

  <section class="grid" aria-label="Tính năng">
    {#each features as f}
      <div class="card feature">
        <Badge tone={f.tone} size={64}><svg viewBox="0 0 100 100"><path d={f.d} /></svg></Badge>
        <strong>{f.name}</strong>
        {#if f.name === 'Xem anime'}
          <button class="btn" onclick={() => (view = 'anime')}>Mở trình phát</button>
        {:else if f.name === 'Lộ trình'}
          <button class="btn" onclick={() => (view = 'roadmap')}>Mở lộ trình</button>
        {:else if f.name === 'Đọc manga'}
          <button class="btn" onclick={() => (view = 'manga')}>Mở</button>
        {:else if f.name === 'Kana & Kanji'}
          <button class="btn" onclick={() => (view = 'kana')}>Mở ra học</button>
        {:else}
          <span class="chip" class:mint={f.note === 'Đã có'}>{f.note === 'Đã có' || f.name === 'Từ điển' ? f.note : `Sắp có · ${f.note}`}</span>
        {/if}
      </div>
    {/each}
  </section>

  <div id="sec-assistant">{#if readyDb}<Assistant db={readyDb} onSessionEnd={async (r) => { await recordSession(readyDb!, r); progressKey++; }} />{/if}</div>

  {#if readyDb}
    <section class="card" id="sec-dictionary" aria-label="Từ điển"><DictionaryPanel db={readyDb} /></section>
  {/if}

  <section id="sec-progress" aria-label="Tiến độ học">
    <h2 class="section-title">Tiến độ học</h2>
    <p><button class="btn soft" onclick={demoSession} disabled={!readyDb}>Học thử 1 buổi (dữ liệu mẫu)</button></p>
    {#if readyDb}<ProgressView db={readyDb} summary={lastSummary} refreshKey={progressKey} />{/if}
    {#if readyDb}<InsightsView db={readyDb} refreshKey={progressKey} />{/if}
  </section>

  <section class="card">
    <h2>Xem thử chữ Nhật</h2>
    <p class="jp sample" lang="ja">
      <ruby>猫<rt>ねこ</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かに<ruby>本<rt>ほん</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む。
    </p>
    <p class="jp sample vertical" lang="ja" style="height: 12rem">
      <ruby>猫<rt>ねこ</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かに<ruby>本<rt>ほん</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む。
    </p>
  </section>

  <section class="card">
    <h2>Cài đặt hiển thị</h2>
    <div class="row" role="radiogroup" aria-label="Giao diện">
      {#each themes as [value, label]}
        <button class="btn" class:soft={settings.theme !== value} role="radio" aria-checked={settings.theme === value}
          onclick={() => (settings.theme = value)}>{label}</button>
      {/each}
    </div>
    <label><input type="checkbox" bind:checked={settings.furigana} /> Hiện furigana (ふりがな)</label>
    <label><input type="checkbox" checked={settings.fontScale > 1} onchange={(e) => (settings.fontScale = e.currentTarget.checked ? 1.25 : 1)} /> Chữ lớn</label>
    <label><input type="checkbox" bind:checked={settings.highContrast} /> Tương phản cao</label>
  </section>

  <section class="card">
    <h2>Kho dữ liệu offline</h2>
    <p class="muted">Dữ liệu lưu ngay trên máy, không cần mạng. Gói nội dung được cài từng phần để cập nhật dần dần.</p>
    <button class="btn" onclick={loadDemo}>Cài gói mẫu (hiragana)</button>
    {#if status}<p role="status">{status}</p>{/if}
    <ul class="jp" lang="ja">
      {#each words as w (w.id)}
        <li><ruby>{w.kanji}<rt>{w.reading}</rt></ruby> — {w.meaning}</li>
      {/each}
    </ul>
  </section>
  {/if}
</main>
<WordPopup />

<style>
  main { max-width: 760px; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-4); }
  main > * { min-width: 0; }
  header { display: flex; align-items: center; gap: var(--space-3); }
  header > :global(div) { min-width: 0; }
  .grid > :global(*) { min-width: 0; }
  h1 { margin: 0; font-size: var(--text-xl); font-weight: 800; color: var(--text); }
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .section-title { margin: 0 0 var(--space-2); font-size: var(--text-lg); color: var(--accent-strong); }
  .muted { color: var(--text-muted); margin: 0; }
  .hero { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; background: var(--surface-2); }
  .hero-text { flex: 1 1 14rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: var(--space-3); }
  .feature { display: grid; gap: var(--space-2); justify-items: start; background: var(--surface-2); }
  .sample { font-size: var(--text-jp-reading); margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
  label { display: block; padding: var(--space-1) 0; }
  input[type='checkbox'] { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); vertical-align: middle; }
</style>
