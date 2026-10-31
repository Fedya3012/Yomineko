<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { installPack } from '../../lib/packs/install';
  import { countQueue } from './session';
  import { syncAnimeCards } from './bridge';
  import { dayKey, loadCards, loadLearned, loadSettings, loadStates, loadStats, saveSettings } from './store';
  import { ALL_TYPES, DEFAULT_SETTINGS, type QuestionType, type SrsSettings } from './types';
  import type { SessionSummary } from '../progress/types';
  import SrsReview from './SrsReview.svelte';
  import demoCards from '../../../packs-src/demo-cards/v1.json';

  let { db, onsession }: { db: DB; onsession?: (summary: SessionSummary) => void } = $props();

  let mode = $state<'home' | 'review' | 'quick'>('home');
  let cardsTotal = $state(0);
  let counts = $state({ due: 0, fresh: 0 });
  let settings = $state<SrsSettings>({ ...DEFAULT_SETTINGS });
  let todayDone = $state(0);
  let hasHistory = $state(false);
  let msg = $state('');

  const typeNames: Record<QuestionType, string> = {
    meaning: 'Nhìn cách đọc, chọn nghĩa', audio: 'Nghe, chọn chữ Hán', handwrite: 'Viết tay chữ Hán', blank: 'Điền vào chỗ trống'
  };

  async function refresh() {
    await syncAnimeCards(db).catch(() => 0); // cards made from anime subtitles join the review queue
    const [cards, states, s, learned] = await Promise.all([loadCards(db), loadStates(db), loadSettings(db), loadLearned(db)]);
    const now = Date.now();
    const stats = await loadStats(db, dayKey(now));
    hasHistory = states.size > 0; settings = s; cardsTotal = cards.length; todayDone = stats.reviewed;
    counts = countQueue({ cards, states, settings: s, stats, now, learned });
  }
  onMount(refresh);

  async function installDemo() {
    try { await installPack(db, demoCards as never); msg = 'Đã thêm bộ thẻ mẫu ✔'; } catch (e) { msg = e instanceof Error ? e.message : String(e); }
    await refresh();
  }
  async function save() { await saveSettings(db, $state.snapshot(settings)); await refresh(); }
  function toggle(t: QuestionType) {
    settings.types = settings.types.includes(t) ? settings.types.filter((x) => x !== t) : [...settings.types, t];
    save();
  }
  async function leave(summary?: SessionSummary) { mode = 'home'; if (summary) onsession?.(summary); await refresh(); }
</script>

{#if mode !== 'home'}
  <SrsReview {db} quick={mode === 'quick'} onexit={leave} />
{:else}
  <section class="card home">
    <h2>Ôn tập thẻ (SRS)</h2>
    {#if cardsTotal === 0}
      <p class="muted">Chưa có thẻ nào. Cài bộ thẻ mẫu để thử, hoặc cài gói thẻ khác ở mục Kho dữ liệu.</p>
      <button class="btn" onclick={installDemo}>Thêm bộ thẻ mẫu</button>
    {:else}
      <div class="stats">
        <div><strong>{counts.due}</strong><span>thẻ đến hạn</span></div>
        <div><strong>{counts.fresh}</strong><span>thẻ mới hôm nay</span></div>
        <div><strong>{todayDone}</strong><span>lượt đã ôn</span></div>
      </div>
      <div class="row">
        <button class="btn" disabled={counts.due + counts.fresh === 0} onclick={() => (mode = 'review')}>Bắt đầu ôn</button>
        <button class="btn soft" disabled={counts.due + counts.fresh === 0} onclick={() => (mode = 'quick')}>⏱ Ôn nhanh 5 phút</button>
      </div>
      {#if counts.due + counts.fresh === 0}
        <p class="muted">{todayDone > 0 || hasHistory ? 'Xong hết rồi! Quay lại sau nhé.' : 'Chưa có gì để ôn. Ôn tập chỉ hỏi những chữ và từ bạn đã học: hãy học bảng chữ cái hoặc kanji ở mục Chữ, đánh dấu "đã học", rồi quay lại đây.'}</p>
      {/if}
    {/if}
    {#if msg}<p role="status">{msg}</p>{/if}

    <details>
      <summary>Cài đặt ôn tập</summary>
      <label>Số thẻ mới mỗi ngày:
        <input type="number" min="0" max="100" bind:value={settings.newPerDay} onchange={save} />
      </label>
      <label>Mức nhớ mong muốn: <strong>{Math.round(settings.retention * 100)}%</strong>
        <input type="range" min="0.8" max="0.97" step="0.01" bind:value={settings.retention} onchange={save} />
      </label>
      <p class="muted">Cao hơn = ôn thường xuyên hơn nhưng nhớ chắc hơn. 90% là mức cân bằng.</p>
      <fieldset>
        <legend>Dạng câu hỏi</legend>
        {#each ALL_TYPES as t}
          <label><input type="checkbox" checked={settings.types.includes(t)} onchange={() => toggle(t)} /> {typeNames[t]}</label>
        {/each}
      </fieldset>
    </details>
  </section>
{/if}

<style>
  .home { display: grid; gap: var(--space-3); }
  h2 { margin: 0; font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: 0; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); text-align: center; }
  .stats div { background: var(--surface-2, var(--bg-sunken)); border-radius: var(--radius); padding: var(--space-3); display: grid; }
  .stats strong { font-size: var(--text-xl); color: var(--accent-strong); }
  .stats span { font-size: var(--text-sm); color: var(--text-muted); }
  .row { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .btn:disabled { opacity: .5; cursor: default; }
  summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 700; }
  label { display: block; padding: var(--space-1) 0; }
  fieldset { border: 1px solid var(--border); border-radius: var(--radius); }
  input[type='number'] { width: 5rem; padding: .3rem; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); }
  input[type='range'] { width: 100%; accent-color: var(--accent); }
  input[type='checkbox'] { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); vertical-align: middle; }
</style>
