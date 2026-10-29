<script lang="ts">
  // The full roadmap: stages N5→N1, today, the weekly schedule, goals and tips.
  // Everything shown is computed from the saved plan plus real progress, so it stays in sync with SRS and Progress.
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { Button, EmptyState, ProgressBar, Mochi } from '../../lib/ui';
  import { LABELS } from './data';
  import { currentStage, goalState, stageProgress, todayState, weekdayIndex, type GoalState } from './evaluate';
  import { editWeek, type WeekEdit } from './generate';
  import { applySuggestions, createRoadmap, loadAnswers, loadLive, loadRoadmap, saveRoadmap, setTick } from './store';
  import Onboarding from './Onboarding.svelte';
  import type { Answers, LinkTarget, Roadmap, Task } from './types';

  let { db, onclose, onopen, onchange }:
    { db: DB; onclose: () => void; onopen: (t: LinkTarget, task: Task) => string | void; onchange?: () => void } = $props();

  let road = $state<Roadmap>();
  let answers = $state<Answers>();
  let live = $state.raw<Awaited<ReturnType<typeof loadLive>>>();
  let editing = $state(false);     // answers form
  let tweaking = $state(false);    // hand-editing the weekly schedule
  let busy = $state(false);
  let msg = $state('');

  async function load() {
    [road, answers, live] = await Promise.all([loadRoadmap(db), loadAnswers(db), loadLive(db)]);
  }
  onMount(load);

  const ratios = $derived(road && live ? stageProgress(road, live.learned) : []);
  const now = $derived(road ? currentStage(ratios) : 0);
  const today = $derived(road && live ? todayState(road, live.today, live.logs.get(live.today), live.ticks, live.srsReviewed) : undefined);
  const todayIndex = $derived(live ? weekdayIndex(live.today) : -1);
  const goalOf = (g: Roadmap['goals'][number]): GoalState | undefined =>
    road && live ? goalState(g, { logs: live.logs, today: live.today, learned: live.learned, ratios, road }) : undefined;

  const dateText = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const pct = (r: number) => `${Math.round(r * 100)}%`;

  async function tick(task: Task, on: boolean) {
    if (!live) return;
    live = { ...live, ticks: await setTick(db, live.today, task.id, on) };
    onchange?.();
  }
  function open(task: Task) { msg = onopen(task.link, task) ?? ''; }

  async function regenerate() {
    busy = true; msg = '';
    try {
      road = await createRoadmap(db, answers ?? {});
      live = await loadLive(db);
      msg = 'Đã tạo lại lộ trình theo dữ liệu học mới nhất.';
      onchange?.();
    } catch (e) { msg = e instanceof Error ? e.message : 'Không tạo lại được.'; }
    busy = false;
  }
  async function tweak(e: WeekEdit) {
    if (!road) return;
    road = editWeek($state.snapshot(road) as Roadmap, e);
    await saveRoadmap(db, $state.snapshot(road) as Roadmap);
    onchange?.();
  }
  async function apply() {
    if (!road) return;
    await applySuggestions(db, $state.snapshot(road) as Roadmap);
    msg = `Đã đặt mục tiêu ${road.suggest.goalMinutes} phút mỗi ngày và ${road.suggest.srsNewPerDay} thẻ mới mỗi ngày.`;
    onchange?.();
  }
  async function done(r: Roadmap) { road = r; answers = await loadAnswers(db); live = await loadLive(db); editing = false; msg = 'Đã lưu lộ trình mới.'; onchange?.(); }
</script>

<div class="page">
  <header>
    <Button variant="ghost" onclick={onclose}>← Về trang chủ</Button>
    <h1>Lộ trình <span lang="ja">学習ルート</span></h1>
  </header>

  {#if editing}
    <Onboarding {db} initial={answers} mode="edit" ondone={done} oncancel={() => (editing = false)} />
  {:else if !road}
    <section class="card"><EmptyState title="Chưa có lộ trình" body="Trả lời vài câu hỏi ngắn để Mochi xếp lịch học cho riêng bạn." />
      <Button onclick={() => (editing = true)}>Tạo lộ trình</Button></section>
  {:else}
    <section class="card summary" aria-label="Tóm tắt">
      <Mochi size={64} mood="cheer" />
      <div>
        <p class="chips"><span class="chip">{road.source === 'ai' ? 'Có lời khuyên từ AI' : 'Lộ trình theo luật (chạy offline)'}</span><span class="chip mint">{LABELS.goal[road.answers.goal]}</span></p>
        <p>{road.summary}</p>
        {#if road.notice}<p class="muted" role="status">{road.notice}</p>{/if}
      </div>
    </section>

    <section class="actions" aria-label="Thao tác">
      <Button variant="soft" onclick={() => (editing = true)}>Chỉnh câu trả lời</Button>
      <Button variant="soft" onclick={regenerate} disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo lại lộ trình'}</Button>
      <Button variant="ghost" onclick={apply}>Áp dụng vào SRS và mục tiêu ngày</Button>
    </section>
    {#if msg}<p role="status" class="status">{msg}</p>{/if}

    <section aria-labelledby="h-stages">
      <h2 id="h-stages">Các giai đoạn</h2>
      <ol class="stages">
        {#each road.stages as s, i}
          <li class="card stage" aria-current={i === now ? 'step' : undefined} class:cur={i === now}>
            <div class="lv"><strong>{s.level}</strong><span class="muted">{s.weeks} tuần</span></div>
            <ProgressBar value={ratios[i] ?? 0} label={`Tiến độ ${s.level}`} />
            <p class="muted">{pct(ratios[i] ?? 0)} · {dateText(s.startDate)} → {dateText(s.endDate)}</p>
            <ul>{#each s.focus as f}<li>{f}</li>{/each}</ul>
            <p class="muted">+{s.add.word} từ · +{s.add.kanji} kanji · +{s.add.grammar} ngữ pháp</p>
          </li>
        {/each}
      </ol>
      <p class="muted">Số lượng từ, kanji và thời gian là ước lượng tham khảo cho từng cấp JLPT, không phải cam kết.</p>
    </section>

    {#if today}
      <section class="card" aria-labelledby="h-today">
        <h2 id="h-today">Hôm nay · {LABELS.days[todayIndex]}</h2>
        {#if today.day.rest}
          <p>Hôm nay là ngày nghỉ. Nghỉ ngơi cũng là một phần của việc học 🌸</p>
        {:else}
          <ProgressBar value={today.plannedMinutes ? today.studiedMinutes / today.plannedMinutes : 0} label="Số phút đã học hôm nay" tone="success" />
          <p class="muted">{today.studiedMinutes} / {today.plannedMinutes} phút{today.complete ? ' · Xong rồi, giỏi quá!' : ''}</p>
          <ul class="tasks">
            {#each today.tasks as t}
              <li>
                <label><input type="checkbox" checked={t.done} disabled={t.task.kind === 'srs' && live && live.srsReviewed > 0} onchange={(e) => tick(t.task, e.currentTarget.checked)} />
                  <span><strong>{t.task.title}</strong> · {t.task.minutes} phút<br /><span class="muted">{t.task.detail}</span></span></label>
                <Button variant="soft" onclick={() => open(t.task)}>Mở</Button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <section aria-labelledby="h-week">
      <h2 id="h-week">Lịch cả tuần</h2>
      <p><Button variant="ghost" onclick={() => (tweaking = !tweaking)} aria-pressed={tweaking}>{tweaking ? 'Xong chỉnh lịch' : 'Chỉnh lịch tuần'}</Button></p>
      <div class="week">
        {#each road.week as d}
          <article class="card day" class:today={d.index === todayIndex} aria-label={LABELS.days[d.index]}>
            <h3>{LABELS.days[d.index]}{d.index === todayIndex ? ' (hôm nay)' : ''}</h3>
            {#if d.rest}
              <p class="muted">Nghỉ</p>
              {#if tweaking}<Button variant="soft" onclick={() => tweak({ type: 'study', index: d.index })}>Thêm buổi học</Button>{/if}
            {:else}
              <ul>
                {#each d.tasks as t}
                  <li>
                    <span><strong>{LABELS.activity[t.kind]}</strong> · {t.minutes}′</span>
                    {#if tweaking && t.kind !== 'srs'}
                      <span class="mini">
                        <button type="button" aria-label={`Giảm 5 phút ${LABELS.activity[t.kind]} ${LABELS.days[d.index]}`} onclick={() => tweak({ type: 'minutes', taskId: t.id, delta: -5 })}>−</button>
                        <button type="button" aria-label={`Tăng 5 phút ${LABELS.activity[t.kind]} ${LABELS.days[d.index]}`} onclick={() => tweak({ type: 'minutes', taskId: t.id, delta: 5 })}>+</button>
                        <button type="button" aria-label={`Bỏ ${LABELS.activity[t.kind]} ${LABELS.days[d.index]}`} onclick={() => tweak({ type: 'remove', taskId: t.id })}>×</button>
                      </span>
                    {/if}
                  </li>
                {/each}
              </ul>
              {#if tweaking}<Button variant="ghost" onclick={() => tweak({ type: 'rest', index: d.index })}>Đặt ngày nghỉ</Button>{/if}
            {/if}
          </article>
        {/each}
      </div>
    </section>

    <section aria-labelledby="h-goals" class="goals">
      {#each [['short', 'Mục tiêu ngắn hạn'], ['long', 'Mục tiêu dài hạn']] as [term, title]}
        <div class="card">
          <h2 id={term === 'short' ? 'h-goals' : undefined}>{title}</h2>
          <ul>
            {#each road.goals.filter((g) => g.term === term) as g}
              {@const st = goalOf(g)}
              <li>
                <span>{st?.met ? '✅ ' : ''}{g.title}{g.dueDate ? ` · hạn ${dateText(g.dueDate)}` : ''}</span>
                <ProgressBar value={st?.ratio ?? 0} label={g.title} tone={st?.met ? 'success' : 'accent'} />
                <span class="muted">{g.metric === 'stage' ? pct(st?.ratio ?? 0) : `${st?.done ?? 0} / ${g.target}`}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>

    {#if road.tips.length}
      <section class="card" aria-labelledby="h-tips">
        <h2 id="h-tips">Lời khuyên của Mochi</h2>
        <ul>{#each road.tips as t}<li>{t}</li>{/each}</ul>
      </section>
    {/if}
  {/if}
</div>

<style>
  .page { display: grid; gap: var(--space-4); }
  header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  h1 { margin: 0; font-size: var(--text-xl); color: var(--accent-strong); }
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); color: var(--accent-strong); }
  h3 { margin: 0 0 var(--space-1); font-size: var(--text-md); }
  .muted { color: var(--text-muted); margin: 0; }
  .summary { display: flex; gap: var(--space-3); align-items: center; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: 0 0 var(--space-2); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .status { background: var(--info-soft); color: var(--info); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); margin: 0; }
  .stages { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--space-3); }
  .stage { display: grid; gap: var(--space-2); align-content: start; }
  .stage.cur { border: 2px solid var(--accent-gfx); background: var(--surface-2); }
  .stage ul, .goals ul, .tasks, .day ul { margin: 0; padding-left: 1.1rem; }
  .lv { display: flex; justify-content: space-between; align-items: baseline; }
  .lv strong { font-size: var(--text-lg); }
  .tasks { list-style: none; padding: 0; display: grid; gap: var(--space-3); margin-top: var(--space-3); }
  .tasks li { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
  .tasks label { display: flex; gap: var(--space-3); align-items: flex-start; }
  input[type='checkbox'] { width: 1.3rem; height: 1.3rem; flex: none; accent-color: var(--accent); margin-top: .2rem; }
  .week { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-3); }
  .day { display: grid; gap: var(--space-2); align-content: start; }
  .day.today { border: 2px solid var(--accent-gfx); }
  .day li { display: flex; justify-content: space-between; gap: var(--space-2); align-items: center; padding: 2px 0; }
  .day ul { list-style: none; padding: 0; }
  .mini { display: inline-flex; gap: 4px; }
  .mini button { min-width: 44px; min-height: 44px; border-radius: var(--radius-pill); border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 800; }
  .goals { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-3); }
  .goals ul { list-style: none; padding: 0; display: grid; gap: var(--space-3); }
  .goals li { display: grid; gap: 4px; }
</style>
