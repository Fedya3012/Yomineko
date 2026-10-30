<script lang="ts">
  import { Button, EmptyState, ProgressBar } from '../../lib/ui';
  import { challengeStatus, scoreFor } from './logic';
  import { METRIC_LABEL, METRIC_UNIT, type Challenge, type Metric, type Person } from './types';
  import './community.css';

  let { challenges, me, today, oncreate }: {
    challenges: Challenge[]; me: Person; today: string;
    oncreate: (kind: 'weekly' | 'monthly', metric: Metric, title: string) => void;
  } = $props();

  let kind = $state<'weekly' | 'monthly'>('weekly');
  let metric = $state<Metric>('minutes');
  let title = $state('');
  const statusText = { upcoming: 'Sắp bắt đầu', active: 'Đang diễn ra', ended: 'Đã kết thúc' } as const;
  const rows = $derived(challenges.map((c) => ({ c, ...challengeStatus(c, today), mine: scoreFor(me, c.metric, c) ?? 0 })));
  // Simple personal targets so the bar means something: a week is ~ 100 min / 200 cards / 10 items / 5 days.
  const goal = (c: Challenge) => (c.kind === 'monthly' ? 4 : 1) * { minutes: 100, cards: 200, words: 10, days: 5 }[c.metric];
</script>

<div class="cm-stack">
  <section class="card" aria-labelledby="c-new">
    <h2 class="cm-h" id="c-new">Tạo thử thách</h2>
    <form class="cm-row" onsubmit={(e) => { e.preventDefault(); oncreate(kind, metric, title); title = ''; }}>
      <label class="cm-field">Kiểu
        <select bind:value={kind}><option value="weekly">Theo tuần này</option><option value="monthly">Theo tháng này</option></select>
      </label>
      <label class="cm-field">Tính theo
        <select bind:value={metric}>{#each Object.entries(METRIC_LABEL) as [k, v]}<option value={k}>{v}</option>{/each}</select>
      </label>
      <label class="cm-field">Tên (không bắt buộc)
        <input bind:value={title} maxlength="60" placeholder="Ví dụ: Ai học nhiều nhất?" />
      </label>
      <Button type="submit">Tạo</Button>
    </form>
    <p class="cm-muted">Thử thách chỉ có hiệu lực với bạn bè sau khi bạn xuất file nhóm và họ nhập vào.</p>
  </section>

  {#if rows.length === 0}
    <EmptyState title="Chưa có thử thách" body="Tạo thử thách tuần hoặc tháng. Mọi người trong nhóm cùng cố gắng, bảng xếp hạng sẽ cho biết ai đang dẫn đầu." />
  {:else}
    <ul class="cm-list">
      {#each rows as r (r.c.id)}
        <li class="card">
          <div class="cm-row">
            <strong style="flex: 1 1 12rem">{r.c.title}</strong>
            <span class="chip" class:mint={r.status === 'active'} class:butter={r.status === 'upcoming'}>{statusText[r.status]}</span>
          </div>
          <p class="cm-muted">{METRIC_LABEL[r.c.metric]} · <span lang="ja">{r.c.start.slice(5)}</span> → <span lang="ja">{r.c.end.slice(5)}</span>{r.status === 'active' ? ` · còn ${r.daysLeft} ngày` : ''}</p>
          <p style="margin: var(--space-2) 0"><strong>Bạn: {r.mine} {METRIC_UNIT[r.c.metric]}</strong></p>
          <ProgressBar value={r.mine / goal(r.c)} label={`Tiến độ của bạn trong ${r.c.title}`} />
        </li>
      {/each}
    </ul>
  {/if}
</div>
