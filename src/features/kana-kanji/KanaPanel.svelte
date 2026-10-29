<script lang="ts">
  import type { DB } from '../../lib/db';
  import type { Kana, Script } from './types';
  import { KANA_KNOWN_KEY, getKnown, setKnown } from './model';
  import { canSpeak, speak } from './speech';
  import StrokeAnimator from './StrokeAnimator.svelte';
  import WritingPad from './WritingPad.svelte';

  let { db, kana }: { db: DB; kana: Kana[] } = $props();

  let script = $state<Script>('hiragana');
  let selected = $state<Kana | null>(null);
  let known = $state<Set<string>>(new Set());
  let step = $state<'watch' | 'write'>('watch');

  const list = $derived(kana.filter((k) => k.script === script));
  const rows = $derived.by(() => {
    const m = new Map<string, Kana[]>();
    for (const k of list) m.set(k.row, [...(m.get(k.row) ?? []), k]);
    return [...m.values()];
  });
  const knownCount = $derived(list.filter((k) => known.has(k.id)).length);

  $effect(() => { getKnown(db, KANA_KNOWN_KEY).then((s) => (known = s)); });

  function open(k: Kana) { selected = k; step = 'watch'; speak(k.char); }
  async function toggleKnown(k: Kana) { known = await setKnown(db, k.id, !known.has(k.id), KANA_KNOWN_KEY); }
</script>

{#if selected}
  {@const k = selected}
  <section class="card detail">
    <button class="btn soft back" onclick={() => (selected = null)}>← Bảng chữ</button>
    <div class="head">
      <span class="big jp" lang="ja">{k.char}</span>
      <div>
        <p class="romaji">{k.romaji}</p>
        <span class="chip {k.script === 'hiragana' ? 'pink' : 'sky'}">{k.script === 'hiragana' ? 'Hiragana' : 'Katakana'} · {k.strokes.length} nét</span>
      </div>
      {#if canSpeak()}<button class="btn soft" onclick={() => speak(k.char)} aria-label="Nghe cách đọc">🔊 Nghe</button>{/if}
    </div>
    <div class="row" role="tablist" aria-label="Bước học">
      <button class="btn" class:soft={step !== 'watch'} role="tab" aria-selected={step === 'watch'} onclick={() => (step = 'watch')}>1. Xem cách viết</button>
      <button class="btn" class:soft={step !== 'write'} role="tab" aria-selected={step === 'write'} onclick={() => (step = 'write')}>2. Tự viết</button>
    </div>
    {#if step === 'watch'}
      <StrokeAnimator strokes={k.strokes} label={`Thứ tự nét của ${k.char}`} />
    {:else}
      <WritingPad strokes={k.strokes} onfinish={(r) => { if (r.stars > 0) setKnown(db, k.id, true, KANA_KNOWN_KEY).then((s) => (known = s)); }} />
    {/if}
    <label class="known"><input type="checkbox" checked={known.has(k.id)} onchange={() => toggleKnown(k)} /> Mình đã thuộc chữ này (đưa vào ôn tập SRS)</label>
  </section>
{:else}
  <section class="card">
    <div class="row" role="tablist" aria-label="Loại chữ">
      <button class="btn" class:soft={script !== 'hiragana'} role="tab" aria-selected={script === 'hiragana'} onclick={() => (script = 'hiragana')}>Hiragana ひらがな</button>
      <button class="btn" class:soft={script !== 'katakana'} role="tab" aria-selected={script === 'katakana'} onclick={() => (script = 'katakana')}>Katakana カタカナ</button>
    </div>
    <p class="muted">Đã thuộc {knownCount}/{list.length}. Chạm vào một chữ để xem nét và tập viết.</p>
    {#each rows as row}
      <div class="kana-row">
        {#each row as k (k.id)}
          <button class="cell jp" class:known={known.has(k.id)} lang="ja" onclick={() => open(k)} aria-label={`${k.char}, đọc là ${k.romaji}`}>
            <span class="c">{k.char}</span><span class="r">{k.romaji}</span>
          </button>
        {/each}
      </div>
    {/each}
  </section>
{/if}

<style>
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
  .muted { color: var(--text-muted); margin: 0 0 var(--space-3); }
  .kana-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--space-2); margin-bottom: var(--space-2); }
  .cell { display: grid; place-items: center; min-height: 64px; padding: var(--space-1); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); line-height: 1.2; }
  .cell .c { font-size: calc(1.7rem * var(--font-scale)); }
  .cell .r { font-size: var(--text-sm); color: var(--text-muted); font-family: var(--font-ui); }
  .cell.known { background: var(--success-soft); border-color: var(--success); }
  .detail { display: grid; gap: var(--space-3); justify-items: center; }
  .back { justify-self: start; }
  .head { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; justify-content: center; }
  .big { font-size: 5rem; line-height: 1.1; color: var(--accent-strong); }
  .romaji { margin: 0; font-size: var(--text-xl); font-weight: 800; }
  .known { padding: var(--space-2) 0; }
  input[type='checkbox'] { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); vertical-align: middle; }
</style>
