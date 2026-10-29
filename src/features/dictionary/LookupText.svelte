<script lang="ts">
  // Shows Japanese text where tapping any word opens its dictionary popup.
  import { dict, openWord } from './state.svelte';
  import { lookupAt } from './lookup';

  let { text }: { text: string } = $props();
  const chars = $derived(Array.from(text));
  let hl = $state<{ from: number; to: number } | null>(null);

  function tap(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
    if (!el || !dict.index) return;
    const i = Number(el.dataset.i);
    const hit = lookupAt(dict.index, text, i);
    if (!hit) { hl = null; return; }
    hl = { from: i, to: i + hit.length };
    openWord(hit.words[0].id);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div class="jp lookup" lang="ja" role="group" aria-label="Chạm vào một từ để tra nghĩa" onclick={tap}>
  {#each chars as ch, i}<span data-i={i} class:on={hl && i >= hl.from && i < hl.to}>{ch}</span>{/each}
</div>

<style>
  .lookup { cursor: pointer; margin: 0; font-size: var(--text-jp-reading); }
  .on { background: var(--accent-soft); border-radius: 3px; }
</style>
