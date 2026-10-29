<script lang="ts">
  import type { DB } from '../../lib/db';
  import type { Kanji } from './types';
  import { KNOWN_KEY, formatKun, getKnown, getPractice, groupByRadical, recordPractice, setKnown, type PracticeRecord } from './model';
  import { canSpeak, speak } from './speech';
  import StrokeAnimator from './StrokeAnimator.svelte';
  import WritingPad from './WritingPad.svelte';

  let { db, kanji }: { db: DB; kanji: Kanji[] } = $props();

  let selected = $state<Kanji | null>(null);
  let known = $state<Set<string>>(new Set());
  let practice = $state<Record<string, PracticeRecord>>({});
  let step = $state<'watch' | 'write'>('watch');

  const groups = $derived(groupByRadical(kanji));
  const knownCount = $derived(kanji.filter((k) => known.has(k.id)).length);

  $effect(() => {
    getKnown(db, KNOWN_KEY).then((s) => (known = s));
    getPractice(db).then((p) => (practice = p));
  });

  function open(k: Kanji) { selected = k; step = 'watch'; }
  async function toggleKnown(k: Kanji) { known = await setKnown(db, k.id, !known.has(k.id)); }
  async function finished(k: Kanji, r: { score: number; stars: number }) {
    practice = { ...practice, [k.id]: await recordPractice(db, k.id, r.score, r.stars) };
    if (r.stars > 0 && !known.has(k.id)) known = await setKnown(db, k.id, true);
  }
</script>

{#if selected}
  {@const k = selected}
  <section class="card detail">
    <button class="btn soft back" onclick={() => (selected = null)}>← Danh sách kanji</button>
    <div class="head">
      <span class="big jp" lang="ja">{k.char}</span>
      <div>
        <p class="vi">{k.vi}</p>
        <p class="meta">
          <span class="chip pink">Bộ <span class="jp" lang="ja">{k.radical.char}</span> {k.radical.name}</span>
          <span class="chip mint">{k.strokes.length} nét</span>
          {#if k.jlpt}<span class="chip sky">{k.jlpt}</span>{/if}
          <span class="chip butter">Lớp {k.grade}</span>
        </p>
      </div>
    </div>

    <div class="block">
      <h3>Cách đọc</h3>
      <p><b>On (音読み):</b> <span class="jp" lang="ja">{k.onyomi.join('、') || '—'}</span></p>
      <p><b>Kun (訓読み):</b> <span class="jp" lang="ja">{k.kunyomi.map(formatKun).join('、') || '—'}</span></p>
      <p class="muted">Nghĩa tiếng Anh: {k.meaningsEn.join(', ')}</p>
    </div>

    <div class="block story">
      <h3>Truyện gợi nhớ</h3>
      <p>{k.mnemonic}</p>
    </div>

    <div class="block">
      <h3>Câu ví dụ</h3>
      {#each k.examples as ex}
        <p class="jp ex" lang="ja">{ex.ja} {#if canSpeak()}<button class="icon" onclick={() => speak(ex.reading)} aria-label="Nghe câu ví dụ">🔊</button>{/if}</p>
        <p class="muted">{ex.reading}</p>
        <p>{ex.vi}</p>
      {/each}
    </div>

    <div class="row" role="tablist" aria-label="Bước học">
      <button class="btn" class:soft={step !== 'watch'} role="tab" aria-selected={step === 'watch'} onclick={() => (step = 'watch')}>1. Xem thứ tự nét</button>
      <button class="btn" class:soft={step !== 'write'} role="tab" aria-selected={step === 'write'} onclick={() => (step = 'write')}>2. Tự viết</button>
    </div>
    {#if step === 'watch'}
      <StrokeAnimator strokes={k.strokes} label={`Thứ tự nét của ${k.char}`} />
    {:else}
      <WritingPad strokes={k.strokes} onfinish={(r) => finished(k, r)} />
      {#if practice[k.id]}<p class="muted">Điểm cao nhất: {practice[k.id].best} ({'★'.repeat(practice[k.id].stars)}{'☆'.repeat(3 - practice[k.id].stars)}) · {practice[k.id].tries} lần thử</p>{/if}
    {/if}
    <label class="known"><input type="checkbox" checked={known.has(k.id)} onchange={() => toggleKnown(k)} /> Mình đã thuộc chữ này (đưa vào ôn tập SRS)</label>
  </section>
{:else}
  <section class="card">
    <p class="muted">Kanji lớp 1, gom theo bộ thủ (phần chung giúp đoán nghĩa). Đã thuộc {knownCount}/{kanji.length}.</p>
    {#each groups as g (g.radical.char)}
      <h3 class="rad"><span class="jp" lang="ja">{g.radical.char}</span> Bộ {g.radical.name || g.radical.char} <span class="chip">{g.kanji.length}</span></h3>
      <div class="grid">
        {#each g.kanji as k (k.id)}
          <button class="cell" class:known={known.has(k.id)} onclick={() => open(k)} aria-label={`${k.char}, ${k.vi}`}>
            <span class="c jp" lang="ja">{k.char}</span>
            <span class="v">{k.vi.split('·')[0].trim()}</span>
            {#if practice[k.id]?.stars}<span class="stars" aria-hidden="true">{'★'.repeat(practice[k.id].stars)}</span>{/if}
          </button>
        {/each}
      </div>
    {/each}
  </section>
{/if}

<style>
  .muted { color: var(--text-muted); margin: 0 0 var(--space-2); }
  h3 { margin: 0 0 var(--space-2); font-size: var(--text-md); color: var(--accent-strong); }
  .rad { display: flex; align-items: center; gap: var(--space-2); margin: var(--space-4) 0 var(--space-2); }
  .rad .jp { font-size: var(--text-lg); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: var(--space-2); }
  .cell { position: relative; display: grid; place-items: center; min-height: 82px; padding: var(--space-1); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); line-height: 1.2; }
  .cell .c { font-size: calc(1.9rem * var(--font-scale)); }
  .cell .v { font-size: var(--text-sm); color: var(--text-muted); }
  .cell .stars { position: absolute; top: 2px; right: 4px; font-size: .7rem; color: var(--butter-500); }
  .cell.known { background: var(--success-soft); border-color: var(--success); }
  .detail { display: grid; gap: var(--space-3); }
  .back { justify-self: start; }
  .head { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
  .big { font-size: 5.5rem; line-height: 1.1; color: var(--accent-strong); }
  .vi { margin: 0 0 var(--space-2); font-size: var(--text-lg); font-weight: 800; }
  .meta { margin: 0; display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .block { background: var(--surface-2); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); }
  .block p { margin: var(--space-1) 0; }
  .story { background: var(--butter-100); color: #5e4700; }
  :global(:root[data-theme='dark']) .story { background: #4a4126; color: #f2d98a; }
  .story h3 { color: inherit; }
  .ex { font-size: var(--text-jp-reading); }
  .icon { border: 0; background: transparent; min-height: 44px; min-width: 44px; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; }
  .known { padding: var(--space-2) 0; }
  input[type='checkbox'] { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); vertical-align: middle; }
  .detail :global(.anim), .detail :global(.pad) { justify-self: center; }
</style>
