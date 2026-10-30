<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { DB } from '../../lib/db';
  import { Segmented } from '../../lib/ui';
  import { loadAssistant } from '../assistant/store';
  import { hasConsent } from '../assistant/assistant';
  import { dateKey, formatDuration } from '../progress/stats';
  import { loadLearned, loadLogs } from '../progress/store';
  import { loadSettings as loadSrsSettings, saveSettings as saveSrsSettings } from '../srs/store';
  import { DEFAULT_SETTINGS } from '../srs/types';
  import { applyRecommendation, recommendDifficulty } from './adaptive';
  import { aiPayload, rewriteOffline, rewriteSummary, STYLE_LABEL, STYLES, type RewriteResult, type SummaryStyle } from './rewrite';
  import { loadInsightsSettings, loadSrsStats, saveInsightsSettings } from './store';
  import { buildStudySummary, PERIOD_LABEL, shiftAnchor, summaryFileName, summaryToMarkdown, type Period } from './summary';
  import { analyzeWeakness, CATEGORY_TIP } from './weakness';

  let { db, refreshKey = 0 }: { db: DB; refreshKey?: number } = $props();

  let period = $state<Period>('week');
  let anchor = $state(dateKey(new Date()));
  let style = $state<SummaryStyle>('standard');
  let data = $state.raw<{ logs: Awaited<ReturnType<typeof loadLogs>>; learned: Awaited<ReturnType<typeof loadLearned>>; srs: Awaited<ReturnType<typeof loadSrsStats>> }>();
  let ai = $state.raw<Awaited<ReturnType<typeof loadAssistant>>>();
  let srsSettings = $state.raw(DEFAULT_SETTINGS);
  let auto = $state(false);
  let rewritten = $state<RewriteResult>();
  let busy = $state(false);
  let showPayload = $state(false);
  let note = $state('');

  async function reload() {
    const [logs, learned, srs, a, s, ins] = await Promise.all([loadLogs(db), loadLearned(db), loadSrsStats(db), loadAssistant(db), loadSrsSettings(db), loadInsightsSettings(db)]);
    data = { logs, learned, srs }; ai = a; srsSettings = s; auto = ins.adaptiveAuto;
    const rec = recommendDifficulty(logs, srs, s, dateKey(new Date()));
    if (ins.adaptiveAuto && rec.changed && ins.lastAuto !== dateKey(new Date())) {
      await saveSrsSettings(db, applyRecommendation(s, rec));
      await saveInsightsSettings(db, { ...ins, lastAuto: dateKey(new Date()) });
      srsSettings = applyRecommendation(s, rec);
      note = 'Đã tự chỉnh độ khó hôm nay.';
    }
  }
  onMount(reload);
  $effect(() => { refreshKey; untrack(() => { if (data) reload(); }); });
  $effect(() => { period; anchor; style; rewritten = undefined; showPayload = false; });

  const summary = $derived(data && buildStudySummary({ ...data, period, anchor }));
  const weak = $derived(data && analyzeWeakness(data.logs, dateKey(new Date())));
  const rec = $derived(data && recommendDifficulty(data.logs, data.srs, srsSettings, dateKey(new Date())));
  const aiReady = $derived(!!ai && ai.settings.useAi && hasConsent(ai.settings));
  const shown = $derived(rewritten?.text ?? (summary ? rewriteOffline(summary, style) : ''));
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  async function copy() {
    try { await navigator.clipboard.writeText(shown); note = 'Đã sao chép ✔'; } catch { note = 'Không sao chép được, hãy thử xuất Markdown.'; }
  }
  function download() {
    if (!summary) return;
    const body = style === 'standard' && !rewritten ? summaryToMarkdown(summary) : `# ${summary.range.title}\n\n${shown}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown' }));
    Object.assign(document.createElement('a'), { href: url, download: summaryFileName(summary) }).click();
    URL.revokeObjectURL(url);
    note = 'Đã xuất file Markdown ✔';
  }
  function offlineRewrite() { if (summary) rewritten = { text: rewriteOffline(summary, style), source: 'offline' }; }
  async function aiRewrite() {
    if (!summary || !ai) return;
    busy = true;
    rewritten = await rewriteSummary(summary, style, { settings: ai.settings, apiKey: ai.apiKey });
    busy = false;
  }
  async function applyRec() {
    if (!rec) return;
    srsSettings = applyRecommendation(srsSettings, rec);
    await saveSrsSettings(db, srsSettings);
    note = 'Đã áp dụng. Xem ở mục Ôn tập thẻ.';
    await reload();
  }
  async function toggleAuto() {
    const ins = await loadInsightsSettings(db);
    await saveInsightsSettings(db, { ...ins, adaptiveAuto: auto });
  }
  const levelText = { easier: 'Nên giảm độ khó', keep: 'Giữ nguyên độ khó', harder: 'Có thể tăng độ khó' };
</script>

{#if summary && weak && rec}
<section class="card stack" aria-label="Tổng kết học tập">
  <h2>Tổng kết học tập</h2>
  <Segmented label="Khoảng thời gian" bind:value={period} options={Object.entries(PERIOD_LABEL) as [Period, string][]} />
  <div class="row">
    <button class="btn soft" aria-label="Kỳ trước" onclick={() => (anchor = shiftAnchor(period, anchor, -1))}>←</button>
    <strong>{summary.range.title}</strong>
    <button class="btn soft" aria-label="Kỳ sau" onclick={() => (anchor = shiftAnchor(period, anchor, 1))}>→</button>
  </div>

  <div class="grid">
    <div class="card stat"><span class="muted">Thời gian</span><strong class="num">{formatDuration(summary.seconds)}</strong></div>
    <div class="card stat"><span class="muted">Đúng</span><strong class="num">{pct(summary.accuracy)}</strong></div>
    <div class="card stat"><span class="muted">Từ / Kanji / Ngữ pháp</span><strong class="num">{summary.touched.word} / {summary.touched.kanji} / {summary.touched.grammar}</strong></div>
    <div class="card stat"><span class="muted">SRS đã ôn</span><strong class="num">{summary.srs.reviewed}</strong></div>
  </div>

  <div>
    <h3>Điểm mạnh</h3>
    <ul>{#each summary.strengths as x}<li>{x}</li>{:else}<li class="muted">Chưa đủ dữ liệu</li>{/each}</ul>
    <h3>Điểm yếu</h3>
    <ul>{#each summary.weaknesses as w}<li><span lang="ja">{w.label}</span> <span class="muted">· {w.detail}</span></li>{:else}<li class="muted">Chưa thấy điểm yếu rõ rệt</li>{/each}</ul>
    <h3>Gợi ý cho buổi sau</h3>
    <ul>{#each summary.suggestions as x}<li>{x}</li>{/each}</ul>
  </div>

  <div class="stack">
    <label>Phong cách viết:
      <select bind:value={style}>{#each STYLES as s}<option value={s}>{STYLE_LABEL[s]}</option>{/each}</select>
    </label>
    <pre class="text" lang="vi">{shown}</pre>
    {#if rewritten?.notice}<p class="muted">{rewritten.notice}</p>{/if}
    {#if rewritten}<p class="muted">Nguồn: {rewritten.source === 'ai' ? 'AI' : 'viết lại offline'}</p>{/if}
    <div class="row">
      <button class="btn soft" onclick={copy}>Sao chép</button>
      <button class="btn soft" onclick={download}>Xuất Markdown</button>
      <button class="btn soft" onclick={offlineRewrite}>Viết lại (offline)</button>
      <button class="btn" onclick={aiRewrite} disabled={!aiReady || busy} title={aiReady ? '' : 'Bật AI và đồng ý gửi dữ liệu trong mục Trợ lý AI'}>
        {busy ? 'Đang viết...' : 'Viết lại bằng AI'}
      </button>
    </div>
    {#if !aiReady}<p class="muted">AI đang tắt hoặc bạn chưa đồng ý gửi dữ liệu (mục Trợ lý AI). Viết lại offline vẫn dùng được.</p>
    {:else}
      <button class="btn soft" onclick={() => (showPayload = !showPayload)}>{showPayload ? 'Ẩn' : 'Xem'} nội dung sẽ gửi cho AI</button>
      {#if showPayload}<pre class="text">{aiPayload(summary)}</pre>{/if}
    {/if}
    {#if note}<p role="status">{note}</p>{/if}
  </div>
</section>

<section class="card stack" aria-label="Phân tích điểm yếu">
  <h2>Điểm yếu hay gặp (30 ngày)</h2>
  {#each weak.categories.slice(0, 5) as c}
    <div>
      <strong>{c.label}</strong> <span class="chip pink">sai {c.missed}/{c.seen} · {pct(c.errorRate)}</span>
      <p class="muted">{CATEGORY_TIP[c.category]}</p>
    </div>
  {:else}
    <p class="muted">Chưa có lỗi nào được ghi lại. Cứ học đi, Mochi sẽ theo dõi giúp.</p>
  {/each}
  <p class="muted">Các từ sai lặp lại sẽ được hỏi trước trong phần Ôn tập thẻ.</p>
</section>

<section class="card stack" aria-label="Độ khó thích ứng">
  <h2>Độ khó thích ứng</h2>
  <p><span class="chip" class:mint={rec.level === 'keep'} class:butter={rec.level !== 'keep'}>{levelText[rec.level]}</span></p>
  <p>{rec.reason}</p>
  <p class="muted">Hiện tại: {srsSettings.newPerDay} thẻ mới/ngày, mức nhớ {Math.round(srsSettings.retention * 100)}%.</p>
  <div class="row"><button class="btn" onclick={applyRec} disabled={!rec.changed}>Áp dụng gợi ý</button></div>
  <label><input type="checkbox" bind:checked={auto} onchange={toggleAuto} /> Tự động chỉnh mỗi ngày (mặc định tắt)</label>
</section>
{/if}

<style>
  .text { white-space: pre-wrap; background: var(--surface-2, var(--surface)); padding: var(--space-3); border-radius: var(--radius-md, 12px); font: inherit; }
  .row { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
  .stat { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); flex-wrap: wrap; }
  .stat .num { margin-left: auto; }
  select { min-height: 44px; }
  ul { padding-left: 1.2rem; }
</style>
