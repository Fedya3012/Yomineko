<script lang="ts">
  import type { DB } from '../../lib/db';
  import { checkAnswer } from './logic';
  import { answerExercise } from './store';
  import type { Lesson, LessonProgress } from './types';

  let { db, lesson, progress, onchange }:
    { db: DB; lesson: Lesson; progress: LessonProgress; onchange: (p: LessonProgress) => void } = $props();

  let typed = $state<Record<string, string>>({});
  let shown = $state<Record<string, boolean>>({}); // exercises answered this visit

  async function submit(id: string, given: string) {
    const ex = lesson.exercises!.find((e) => e.id === id)!;
    const ok = checkAnswer(ex, given);
    shown[id] = true;
    const r = await answerExercise(db, lesson, id, ok);
    onchange(r.progress);
  }
  const answers = (a: string | string[]) => (Array.isArray(a) ? a.join(' / ') : a);
  const correctNow = (id: string, given: string) => {
    const ex = lesson.exercises!.find((e) => e.id === id)!;
    return checkAnswer(ex, given);
  };
</script>

<ol class="list">
  {#each lesson.exercises ?? [] as ex, i (ex.id)}
    <li class="card q" class:right={progress.results[ex.id]}>
      <p class="prompt jp" lang="ja"><span class="no">{i + 1}.</span> {ex.prompt}</p>
      {#if ex.type === 'choice'}
        <div class="choices">
          {#each ex.choices as c}
            <button class="btn soft" class:ok={shown[ex.id] && c === ex.answer} type="button"
              onclick={() => { typed[ex.id] = c; submit(ex.id, c); }}>{c}</button>
          {/each}
        </div>
      {:else}
        <form onsubmit={(e) => { e.preventDefault(); submit(ex.id, typed[ex.id] ?? ''); }}>
          <input class="jp" lang="ja" bind:value={typed[ex.id]} aria-label={`Câu ${i + 1}`} autocomplete="off" />
          <button class="btn" type="submit">Kiểm tra</button>
        </form>
      {/if}
      {#if shown[ex.id]}
        <p class="result" role="status" class:bad={!correctNow(ex.id, typed[ex.id] ?? '')}>
          {correctNow(ex.id, typed[ex.id] ?? '') ? 'Đúng rồi! ✔' : `Chưa đúng. Đáp án: ${answers(ex.answer)}`}
          {#if ex.explain}<span class="muted"> {ex.explain}</span>{/if}
        </p>
      {:else if progress.results[ex.id]}
        <p class="result">Đã làm đúng trước đó ✔</p>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .q { background: var(--surface-2); }
  .q.right { border-color: var(--success); }
  .prompt { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .no { color: var(--accent-strong); font-weight: 800; }
  .choices { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .choices .ok { background: var(--success-soft); color: var(--success); }
  form { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  input { flex: 1 1 10rem; min-height: 44px; padding: .4rem .9rem; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); font-size: var(--text-md); }
  .result { margin: var(--space-2) 0 0; color: var(--success); font-weight: 700; }
  .result.bad { color: var(--accent-strong); }
  .muted { color: var(--text-muted); font-weight: 400; }
</style>
