<script lang="ts">
  // Small card for the home screen: what to do today, or an invitation to create a roadmap.
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { Button, ProgressBar } from '../../lib/ui';
  import { LABELS } from './data';
  import { todayState, weekdayIndex, type TodayState } from './evaluate';
  import { loadLive, loadRoadmap, setTick } from './store';
  import type { Roadmap } from './types';

  let { db, refreshKey = 0, onview, oncreate }: { db: DB; refreshKey?: number; onview: () => void; oncreate: () => void } = $props();

  let road = $state.raw<Roadmap>();
  let plan = $state.raw<TodayState>();
  let loaded = $state(false);
  let today = $state('');

  async function load() {
    const [r, live] = await Promise.all([loadRoadmap(db), loadLive(db)]);
    road = r; today = live.today;
    plan = r ? todayState(r, live.today, live.logs.get(live.today), live.ticks, live.srsReviewed) : undefined;
    loaded = true;
  }
  onMount(load);
  $effect(() => { refreshKey; if (loaded) load(); });

  async function tick(id: string, on: boolean) { await setTick(db, today, id, on); await load(); }
</script>

{#if loaded}
  <section class="card" aria-labelledby="today-title">
    {#if !road || !plan}
      <h2 id="today-title">Lộ trình học</h2>
      <p class="muted">Trả lời vài câu hỏi để Mochi xếp lịch học riêng cho bạn, từ N5 tới N1.</p>
      <Button onclick={oncreate}>Tạo lộ trình</Button>
    {:else}
      <h2 id="today-title">Hôm nay · {LABELS.days[weekdayIndex(today)]}</h2>
      {#if plan.day.rest}
        <p class="muted">Ngày nghỉ. Mai học tiếp nhé 🌸</p>
      {:else}
        <ProgressBar value={plan.plannedMinutes ? plan.studiedMinutes / plan.plannedMinutes : 0} label="Số phút đã học hôm nay" tone="success" />
        <p class="muted">{plan.studiedMinutes} / {plan.plannedMinutes} phút{plan.complete ? ' · Xong rồi!' : ''}</p>
        <ul>
          {#each plan.tasks as t}
            <li><label><input type="checkbox" checked={t.done} disabled={t.task.kind === 'srs' && t.done} onchange={(e) => tick(t.task.id, e.currentTarget.checked)} /> {t.task.title} · {t.task.minutes} phút</label></li>
          {/each}
        </ul>
      {/if}
      <Button variant="soft" onclick={onview}>Xem lộ trình</Button>
    {/if}
  </section>
{/if}

<style>
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: var(--space-2) 0; }
  ul { list-style: none; padding: 0; margin: 0 0 var(--space-3); }
  li label { display: flex; gap: var(--space-2); align-items: center; min-height: 44px; }
  input[type='checkbox'] { width: 1.3rem; height: 1.3rem; accent-color: var(--accent); }
</style>
