<script lang="ts">
  import { EmptyState, ProgressBar, Segmented } from '../../lib/ui';
  import { leaderboard, monthRange, weekRange } from './logic';
  import { METRIC_LABEL, METRIC_UNIT, type Challenge, type Metric, type Person } from './types';
  import './community.css';

  let { members, challenges, myId, today }: { members: Person[]; challenges: Challenge[]; myId: string; today: string } = $props();

  let period = $state<'week' | 'month' | 'challenge'>('week');
  let metric = $state<Metric>('minutes');
  let challengeId = $state('');

  const challenge = $derived(period === 'challenge' ? (challenges.find((c) => c.id === challengeId) ?? challenges[0]) : undefined);
  const win = $derived(challenge ?? (period === 'week' ? weekRange(today) : monthRange(today)));
  const activeMetric = $derived<Metric>(challenge?.metric ?? metric);
  const rows = $derived(leaderboard(members, activeMetric, win));
  const top = $derived(Math.max(1, ...rows.map((r) => r.score ?? 0)));
  const periods: ['week' | 'month' | 'challenge', string][] = [['week', 'Tuần này'], ['month', 'Tháng này'], ['challenge', 'Thử thách']];
  const metrics: [Metric, string][] = [['minutes', 'Phút'], ['cards', 'Thẻ'], ['words', 'Mục mới'], ['days', 'Ngày học']];
</script>

<div class="cm-stack">
  <section class="card" aria-label="Chọn cách xếp hạng">
    <div class="cm-stack">
      <Segmented bind:value={period} options={periods} label="Khoảng thời gian" />
      {#if period === 'challenge'}
        {#if challenges.length}
          <label class="cm-field">Thử thách
            <select bind:value={challengeId}>{#each challenges as c}<option value={c.id}>{c.title}</option>{/each}</select>
          </label>
        {:else}
          <p class="cm-muted">Nhóm chưa có thử thách. Tạo ở thẻ “Thử thách”.</p>
        {/if}
      {:else}
        <Segmented bind:value={metric} options={metrics} label="Xếp theo" />
      {/if}
      <p class="cm-muted">{METRIC_LABEL[activeMetric]} · <span lang="ja">{win.start.slice(5)}</span> → <span lang="ja">{win.end.slice(5)}</span></p>
    </div>
  </section>

  {#if members.length === 0}
    <EmptyState title="Chưa có ai trong bảng" body="Nhập file của bạn bè để thấy họ ở đây." />
  {:else}
    <ol class="cm-list" aria-label="Bảng xếp hạng">
      {#each rows as r (r.person.id)}
        <li class="card row" class:me={r.person.id === myId}>
          <span class="rank r{r.rank ?? 0}" aria-label={r.rank ? `Hạng ${r.rank}` : 'Chưa xếp hạng'}>{r.rank ?? '–'}</span>
          <div class="grow">
            <div><strong>{r.person.name}</strong>{#if r.person.id === myId} <span class="chip pink">Bạn</span>{/if}</div>
            {#if r.score === null}
              <p class="cm-muted">Bạn này không chia sẻ số liệu này</p>
            {:else}
              <ProgressBar value={r.score / top} label={`${r.person.name}: ${r.score} ${METRIC_UNIT[activeMetric]}`} />
            {/if}
          </div>
          {#if r.score !== null}<strong class="score">{r.score}<small> {METRIC_UNIT[activeMetric]}</small></strong>{/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .row { display: flex; align-items: center; gap: var(--space-3); box-shadow: var(--shadow-sm); }
  .row.me { background: var(--accent-soft); }
  .grow { flex: 1; min-width: 0; display: grid; gap: var(--space-1); }
  .grow p { margin: 0; }
  .score { font-size: var(--text-lg); white-space: nowrap; }
  .score small { font-size: var(--text-sm); font-weight: 400; color: var(--text-muted); }
  .rank { flex: none; display: inline-grid; place-items: center; width: 2.5rem; height: 2.5rem; border-radius: 50%; border: 2px solid var(--ink); font-weight: 800; background: var(--surface-2); }
  .r1 { background: var(--butter-100); color: #5c4300; }
  .r2 { background: var(--sky-100); color: #1f4a73; }
  .r3 { background: var(--peach-100); color: #6b3412; }
  :global(:root[data-theme="dark"]) .r1 { background: #4a4126; color: #f2d98a; }
  :global(:root[data-theme="dark"]) .r2 { background: #263a4f; color: #a9d0f5; }
  :global(:root[data-theme="dark"]) .r3 { background: #4a3322; color: #ffc9a3; }
</style>
