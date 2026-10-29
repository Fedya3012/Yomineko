<script lang="ts">
  // First-launch questions (one per step) and the same questions on one page when editing.
  import type { DB } from '../../lib/db';
  import { Button, Mochi, ProgressBar } from '../../lib/ui';
  import { GOAL_DEFAULT_TARGET, LABELS } from './data';
  import { generateRoadmap, normalizeAnswers } from './generate';
  import { applySuggestions, createRoadmap, setSkipped } from './store';
  import { DEFAULT_ANSWERS, LEVELS, type Answers, type Roadmap, type WeakPoint } from './types';

  let { db, initial, mode = 'first', ondone, oncancel }:
    { db: DB; initial?: Answers; mode?: 'first' | 'edit'; ondone: (r: Roadmap) => void; oncancel: () => void } = $props();

  // `initial` is only the starting value; the form is the learner's own copy from then on.
  // svelte-ignore state_referenced_locally
  let a = $state<Answers>({ ...DEFAULT_ANSWERS, ...initial, weak: [...(initial?.weak ?? [])] });
  let step = $state(0);
  let busy = $state(false);
  let error = $state('');
  let apply = $state(true);

  const steps = ['level', 'goal', 'time', 'content', 'weak', 'style', 'review'] as const;
  const edit = $derived(mode === 'edit');
  const current = $derived(steps[step]);
  const show = (s: (typeof steps)[number]) => edit ? s !== 'review' : current === s;
  const preview = $derived(generateRoadmap(a));
  const totalWeeks = $derived(preview.stages.reduce((s, x) => s + x.weeks, 0));
  const titles: Record<(typeof steps)[number], string> = {
    level: 'Trình độ hiện tại của bạn?', goal: 'Mục tiêu chính của bạn?', time: 'Bạn học được bao lâu?', content: 'Bạn thích nội dung nào?',
    weak: 'Bạn thấy mình yếu phần nào?', style: 'Bạn thích học kiểu nào?', review: 'Lộ trình của bạn đã sẵn sàng'
  };
  const minuteChoices = [5, 10, 15, 20, 30, 45, 60, 90];

  function pickGoal(g: Answers['goal']) { a.goal = g; a.targetLevel = GOAL_DEFAULT_TARGET[g]; }
  function toggleWeak(w: WeakPoint) { a.weak = a.weak.includes(w) ? a.weak.filter((x) => x !== w) : [...a.weak, w]; }

  async function finish() {
    busy = true; error = '';
    try {
      const road = await createRoadmap(db, normalizeAnswers($state.snapshot(a)));
      if (apply) await applySuggestions(db, road);
      ondone(road);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Không tạo được lộ trình, thử lại nhé.';
    } finally {
      busy = false;
    }
  }
  async function skip() { await setSkipped(db, true); oncancel(); }
</script>

{#snippet choice<T extends string>(label: string, value: T, options: [T, string][], set: (v: T) => void)}
  <div class="choices" role="radiogroup" aria-label={label}>
    {#each options as [v, text]}
      <button type="button" role="radio" class="choice" aria-checked={value === v} class:on={value === v} onclick={() => set(v)}>{text}</button>
    {/each}
  </div>
{/snippet}

<section class="card wrap" aria-labelledby="ob-title">
  <header>
    <Mochi size={72} mood={current === 'review' ? 'cheer' : 'happy'} />
    <div>
      <p class="kicker" lang="ja">ようこそ</p>
      <h2 id="ob-title">{edit ? 'Chỉnh câu trả lời' : titles[current]}</h2>
      {#if !edit}<p class="muted">Bước {step + 1} / {steps.length}</p>{/if}
    </div>
  </header>
  {#if !edit}<ProgressBar value={(step + 1) / steps.length} label="Tiến trình trả lời" />{/if}

  {#if show('level')}
    <fieldset>
      {#if edit}<legend>Trình độ hiện tại</legend>{/if}
      {@render choice('Trình độ', a.level, Object.entries(LABELS.level) as [Answers['level'], string][], (v) => (a.level = v))}
      <p class="muted">Chọn mức bạn đã học xong. Không chắc thì chọn thấp hơn, học lại phần dễ rất nhanh.</p>
    </fieldset>
  {/if}

  {#if show('goal')}
    <fieldset>
      {#if edit}<legend>Mục tiêu chính</legend>{/if}
      {@render choice('Mục tiêu', a.goal, Object.entries(LABELS.goal) as [Answers['goal'], string][], pickGoal)}
      <p class="field-label" id="target-l">Muốn tới cấp độ</p>
      {@render choice('Cấp độ muốn đạt', a.targetLevel, LEVELS.map((l) => [l, l] as [Answers['targetLevel'], string]), (v) => (a.targetLevel = v))}
    </fieldset>
  {/if}

  {#if show('time')}
    <fieldset>
      {#if edit}<legend>Thời gian học</legend>{/if}
      <p class="field-label">Số phút mỗi ngày</p>
      {@render choice('Số phút mỗi ngày', String(a.minutesPerDay), minuteChoices.map((m) => [String(m), `${m} phút`] as [string, string]), (v) => (a.minutesPerDay = Number(v)))}
      <p class="field-label">Số ngày mỗi tuần</p>
      {@render choice('Số ngày mỗi tuần', String(a.daysPerWeek), [3, 4, 5, 6, 7].map((d) => [String(d), `${d} ngày`] as [string, string]), (v) => (a.daysPerWeek = Number(v)))}
      <p class="muted">Ít mà đều tốt hơn nhiều mà bỏ giữa chừng. Bạn đổi lại được bất cứ lúc nào.</p>
    </fieldset>
  {/if}

  {#if show('content')}
    <fieldset>
      {#if edit}<legend>Nội dung yêu thích</legend>{/if}
      {@render choice('Nội dung yêu thích', a.content, Object.entries(LABELS.content) as [Answers['content'], string][], (v) => (a.content = v))}
      <p class="muted">Mochi dùng lựa chọn này để xếp truyện hoặc phim nào học trước. Bạn tự nạp file của mình vào app.</p>
    </fieldset>
  {/if}

  {#if show('weak')}
    <fieldset>
      {#if edit}<legend>Điểm yếu</legend>{/if}
      <div class="choices" role="group" aria-label="Điểm yếu (chọn nhiều)">
        {#each Object.entries(LABELS.weak) as [w, text]}
          <button type="button" class="choice" aria-pressed={a.weak.includes(w as WeakPoint)} class:on={a.weak.includes(w as WeakPoint)} onclick={() => toggleWeak(w as WeakPoint)}>{text}</button>
        {/each}
      </div>
      <p class="muted">Chọn nhiều cũng được, hoặc bỏ trống nếu chưa biết.</p>
    </fieldset>
  {/if}

  {#if show('style')}
    <fieldset>
      {#if edit}<legend>Kiểu học</legend>{/if}
      {@render choice('Kiểu học', a.style, Object.entries(LABELS.style) as [Answers['style'], string][], (v) => (a.style = v))}
      <p class="field-label">Giáo trình đang dùng</p>
      {@render choice('Giáo trình', a.book, Object.entries(LABELS.book) as [Answers['book'], string][], (v) => (a.book = v))}
    </fieldset>
  {/if}

  {#if current === 'review' && !edit}
    <div class="review">
      <p><strong>{LABELS.goal[a.goal]}</strong>: {preview.startLevel} → {a.targetLevel}, khoảng <strong>{totalWeeks} tuần</strong> với {a.minutesPerDay} phút × {a.daysPerWeek} ngày.</p>
      <p class="muted">Lộ trình tạo ngay trên máy, không cần mạng. Nếu bạn bật AI trong phần trợ lý, Mochi chỉ viết lời khuyên thêm (gửi đi duy nhất các câu trả lời ở trên).</p>
      <label><input type="checkbox" bind:checked={apply} /> Đặt mục tiêu ngày ({preview.suggest.goalMinutes} phút) và {preview.suggest.srsNewPerDay} thẻ mới mỗi ngày theo lộ trình</label>
    </div>
  {/if}
  {#if error}<p class="err" role="alert">{error}</p>{/if}

  <footer>
    {#if edit}
      <Button variant="ghost" onclick={oncancel}>Huỷ</Button>
      <Button onclick={finish} disabled={busy}>{busy ? 'Đang tạo…' : 'Lưu và tạo lại lộ trình'}</Button>
    {:else}
      {#if step === 0}<Button variant="ghost" onclick={skip}>Bỏ qua, dùng mặc định</Button>{:else}<Button variant="ghost" onclick={() => step--}>Quay lại</Button>{/if}
      {#if current === 'review'}
        <Button size="lg" onclick={finish} disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo lộ trình'}</Button>
      {:else}
        <Button onclick={() => step++}>Tiếp</Button>
      {/if}
    {/if}
  </footer>
</section>

<style>
  .wrap { display: grid; gap: var(--space-4); }
  header { display: flex; align-items: center; gap: var(--space-3); }
  h2 { margin: 0; font-size: var(--text-lg); color: var(--accent-strong); }
  .kicker { margin: 0; color: var(--text-muted); font-size: var(--text-sm); }
  .muted { color: var(--text-muted); margin: var(--space-2) 0 0; }
  fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
  legend { font-weight: 800; padding: 0; margin-bottom: var(--space-2); }
  .field-label { margin: var(--space-2) 0 0; font-weight: 700; }
  .choices { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .choice { min-height: 44px; padding: 0 var(--space-4); border-radius: var(--radius-pill); border: 2px solid var(--border-strong); background: var(--surface); color: var(--text); font-weight: 700; }
  .choice.on { background: var(--accent-soft); color: var(--accent-strong); border-color: var(--accent-gfx); }
  .review { display: grid; gap: var(--space-2); background: var(--surface-2); border-radius: var(--radius); padding: var(--space-4); }
  .review p { margin: 0; }
  .err { color: var(--warn); background: var(--warn-soft); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); margin: 0; }
  footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2); }
</style>
