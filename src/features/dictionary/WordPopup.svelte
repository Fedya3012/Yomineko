<script lang="ts">
  import { dict, closePopup, popupBack, openWord } from './state.svelte';
  import WordEntry from './WordEntry.svelte';

  const wordId = $derived(dict.popup[dict.popup.length - 1]);
  const word = $derived(wordId && dict.index ? dict.index.get(wordId) : undefined);
  const title = $derived(word ? (word.kanji[0]?.text ?? word.kana[0].text) : '');
  let closeBtn = $state<HTMLButtonElement>();
  $effect(() => { if (word) closeBtn?.focus(); });
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closePopup(); }
</script>

<svelte:window onkeydown={onKey} />

{#if word}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={closePopup}>
    <div class="sheet card" role="dialog" aria-modal="true" aria-label={`Từ điển: ${title}`} tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <div class="top">
        {#if dict.popup.length > 1}<button class="btn soft" onclick={popupBack} aria-label="Quay lại">←</button>{/if}
        <button class="btn soft close" bind:this={closeBtn} onclick={closePopup} aria-label="Đóng">✕</button>
      </div>
      <WordEntry {wordId} context={dict.context} onOpen={(id) => openWord(id)} />
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / .4); display: grid; place-items: end center; z-index: 50; }
  .sheet { width: min(640px, 100%); max-height: 88dvh; overflow-y: auto; border-radius: var(--radius) var(--radius) 0 0; }
  @media (min-width: 700px) { .backdrop { place-items: center; } .sheet { border-radius: var(--radius); } }
  .top { display: flex; justify-content: space-between; }
  .close { margin-left: auto; }
</style>
