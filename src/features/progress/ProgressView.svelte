<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import Heatmap from './Heatmap.svelte';
  import LineChart from './LineChart.svelte';
  import SessionSummaryCard from './SessionSummaryCard.svelte';
  import { loadOverview, saveSettings } from './store';
  import { buildHeatmap, buildSeries, formatDuration, totalSeconds } from './stats';
  import type { GoalUnit, SessionSummary } from './types';

  let { db, summary = undefined, refreshKey = 0 }: { db: DB; summary?: SessionSummary; refreshKey?: number } = $props();

  type Overview = Awaited<ReturnType<typeof loadOverview>>;
  let ov = $state.raw<Overview>();
  let range = $state(30);
  let openDay = $state<string>();

  async function reload() { ov = await loadOverview(db); }
  onMount(reload);
  $effect(() => { refreshKey; if (ov) reload(); });

  const series = $derived(ov && buildSeries(ov.logs, ov.learned, ov.today, range));
  const heat = $derived(ov && buildHeatmap(ov.logs, ov.today, 26));
  const days = $derived(ov && [...ov.logs.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14));
  const unit = (u: GoalUnit) => (u === 'minutes' ? 'phút' : 'thẻ');

  async function updateSettings(patch: (s: Overview['settings']) => Overview['settings']) {
    if (!ov) return;
    await saveSettings(db, patch(ov.settings));
    await reload();
  }
</script>

{#if ov && series && heat && days}
  <div class="stack">
    <section class="grid" aria-label="Tổng quan">
      <div class="card stat">
        <span class="muted">Chuỗi ngày học</span>
        <strong class="num">{ov.streak.current} <small>ngày</small></strong>
        <span class="chips"><span class="chip butter">Kỷ lục {ov.streak.longest}</span> <span class="chip butter">Băng đóng còn {ov.streak.freezesLeft}</span></span>
      </div>
      <div class="card stat">
        <span class="muted">Mục tiêu hôm nay</span>
        <strong class="num">{ov.goal.done}/{ov.goal.target} <small>{unit(ov.goal.unit)}</small></strong>
        <progress max="1" value={ov.goal.ratio} aria-label="Tiến độ mục tiêu ngày"></progress>
        {#if ov.goal.met}<span class="chip mint">Đạt rồi! ✔</span>{/if}
      </div>
      <div class="card stat"><span class="muted">Từ vựng</span><strong class="num">{ov.counts.word}</strong></div>
      <div class="card stat"><span class="muted">Kanji</span><strong class="num">{ov.counts.kanji}</strong></div>
      <div class="card stat"><span class="muted">Ngữ pháp</span><strong class="num">{ov.counts.grammar}</strong></div>
      <div class="card stat"><span class="muted">Tổng thời gian học</span><strong class="num small">{formatDuration(totalSeconds(ov.logs.values()))}</strong></div>
    </section>

    {#if summary}<SessionSummaryCard {summary} />{/if}

    <section class="card">
      <h2>Mục tiêu & băng đóng</h2>
      <div class="row">
        <label>Mục tiêu mỗi ngày
          <input type="number" min="1" inputmode="numeric" value={ov.settings.goal.target}
            onchange={(e) => updateSettings((s) => ({ ...s, goal: { ...s.goal, target: Number(e.currentTarget.value) || 1 } }))} />
        </label>
        <label>Đơn vị
          <select value={ov.settings.goal.unit} onchange={(e) => updateSettings((s) => ({ ...s, goal: { ...s.goal, unit: e.currentTarget.value as GoalUnit } }))}>
            <option value="minutes">Phút</option>
            <option value="cards">Số thẻ</option>
          </select>
        </label>
        <label>Băng đóng mỗi tháng
          <select value={ov.settings.freezesPerMonth} onchange={(e) => updateSettings((s) => ({ ...s, freezesPerMonth: Number(e.currentTarget.value) === 2 ? 2 : 1 }))}>
            <option value={1}>1 ngày</option>
            <option value={2}>2 ngày</option>
          </select>
        </label>
      </div>
      <p class="muted">Quên học một ngày thì băng đóng giữ chuỗi cho bạn, không cần làm gì cả.</p>
    </section>

    <section class="card">
      <h2>Tiến bộ theo thời gian</h2>
      <div class="row" role="radiogroup" aria-label="Khoảng thời gian">
        {#each [30, 90, 180] as r}
          <button class="btn" class:soft={range !== r} role="radio" aria-checked={range === r} onclick={() => (range = r)}>{r} ngày</button>
        {/each}
      </div>
      <LineChart {series} />
    </section>

    <section class="card">
      <h2>Bản đồ hoạt động</h2>
      <Heatmap weeks={heat} />
    </section>

    <section class="card">
      <h2>Điểm yếu hay gặp lại</h2>
      {#if ov.weak.length}
        <ul class="jp" lang="ja">
          {#each ov.weak as w}<li>{w.label} <span class="muted">— sai {w.misses} lần, trong {w.days.length} ngày</span></li>{/each}
        </ul>
      {:else}
        <p class="muted">Chưa có mục nào bị sai lặp lại ở nhiều ngày. Tốt lắm!</p>
      {/if}
    </section>

    <section class="card">
      <h2>Lịch sử từng ngày</h2>
      {#if days.length === 0}<p class="muted">Chưa có buổi học nào.</p>{/if}
      {#each days as d (d.date)}
        <button class="day" aria-expanded={openDay === d.date} onclick={() => (openDay = openDay === d.date ? undefined : d.date)}>
          <strong>{d.date}</strong>
          <span class="muted">{formatDuration(d.seconds)} · {d.cards} thẻ · {d.sessions} buổi</span>
        </button>
        {#if openDay === d.date}
          <ul class="jp items" lang="ja">
            {#each Object.values(d.items) as it}
              <li>{it.label} <span class="muted">· {it.seen} lần{it.missed ? `, sai ${it.missed}` : ''}</span></li>
            {/each}
          </ul>
        {/if}
      {/each}
    </section>
  </div>
{/if}

<style>
  .stack { display: grid; gap: var(--space-4); }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: var(--space-3); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-1); }
  .stat { display: grid; gap: var(--space-1); align-content: start; background: var(--surface-2); }
  .num { font-size: var(--text-xl); color: var(--accent-strong); }
  .num.small { font-size: var(--text-lg); }
  .num small { font-size: var(--text-sm); color: var(--text-muted); font-weight: 600; }
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-3); align-items: end; }
  label { display: grid; gap: var(--space-1); font-size: var(--text-sm); color: var(--text-muted); }
  input, select { min-height: 44px; padding: 0 var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); }
  progress { width: 100%; height: .6rem; accent-color: var(--accent); }
  ul { margin: 0; padding-left: 1.2rem; display: grid; gap: var(--space-1); }
  .day { display: flex; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; width: 100%; min-height: 44px; align-items: center; text-align: left; background: none; border: 0; border-top: 1px solid var(--border); padding: var(--space-2) 0; }
  .items { padding-bottom: var(--space-2); }
</style>
