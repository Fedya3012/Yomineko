<script lang="ts">
  import { formatDuration } from './stats';
  import { summaryFileName, summaryToMarkdown, summaryToText } from './summary';
  import type { SessionSummary } from './types';

  let { summary }: { summary: SessionSummary } = $props();
  let note = $state('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(summaryToText(summary));
      note = 'Đã sao chép ✔';
    } catch {
      note = 'Không sao chép được, hãy thử xuất Markdown.';
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([summaryToMarkdown(summary)], { type: 'text/markdown' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: summaryFileName(summary) });
    a.click();
    URL.revokeObjectURL(url);
    note = 'Đã xuất file Markdown ✔';
  }
</script>

<section class="card" aria-label="Tóm tắt buổi học">
  <h2>Tóm tắt buổi học</h2>
  <p class="big">{formatDuration(summary.minutes * 60)} · {summary.cards} thẻ · đúng {Math.round(summary.accuracy * 100)}%</p>
  <p>
    {#if summary.newlyLearned.word}<span class="chip mint">{summary.newlyLearned.word} từ mới</span>{/if}
    {#if summary.newlyLearned.kanji}<span class="chip sky">{summary.newlyLearned.kanji} kanji mới</span>{/if}
    {#if summary.newlyLearned.grammar}<span class="chip butter">{summary.newlyLearned.grammar} ngữ pháp mới</span>{/if}
    <span class="chip" class:pink={summary.goal.met}>Mục tiêu {summary.goal.done}/{summary.goal.target} {summary.goal.unit === 'minutes' ? 'phút' : 'thẻ'}{summary.goal.met ? ' ✔' : ''}</span>
    <span class="chip pink">Chuỗi {summary.streak} ngày</span>
  </p>
  {#if summary.weak.length}
    <p class="muted">Cần ôn thêm:</p>
    <ul class="jp" lang="ja">
      {#each summary.weak as w}<li>{w.label} <span class="muted">(sai {w.misses})</span></li>{/each}
    </ul>
  {/if}
  <div class="row">
    <button class="btn" onclick={copy}>Sao chép</button>
    <button class="btn soft" onclick={download}>Xuất Markdown</button>
  </div>
  {#if note}<p role="status" class="muted">{note}</p>{/if}
</section>

<style>
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .big { font-size: var(--text-lg); margin: 0 0 var(--space-2); }
  .muted { color: var(--text-muted); margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
  ul { margin: var(--space-1) 0 0; padding-left: 1.2rem; }
</style>
