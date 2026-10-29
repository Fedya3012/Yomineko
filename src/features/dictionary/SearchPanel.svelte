<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { dict, openWord } from './state.svelte';
  import { clearSearchSources, dictionarySource, registerSearchSource, searchAll, userContentSource, type GlobalResults } from './globalSearch';

  let { db }: { db: DB } = $props();
  let query = $state('');
  let results = $state<GlobalResults | undefined>();
  let seq = 0;

  onMount(() => {
    registerSearchSource(dictionarySource(() => dict.index));
    registerSearchSource(userContentSource(db));
    return () => clearSearchSources();
  });

  // debounce 150 ms; ignore answers that arrive after a newer query
  $effect(() => {
    const q = query.trim(); void dict.index;
    if (!q) { results = undefined; return; }
    const mine = ++seq;
    const t = setTimeout(async () => { const r = await searchAll(q); if (mine === seq) results = r; }, 150);
    return () => clearTimeout(t);
  });

  const none = $derived(results && !results.dictionary.length && !results.user.length && !results.other.length);
</script>

<div class="search">
  <input type="search" bind:value={query} placeholder="Tìm từ: 猫, ねこ, neko hoặc “cat”…" aria-label="Tìm kiếm" />
  {#if !dict.index}
    <p class="muted">Chưa có gói từ điển. Hãy cài gói từ điển để tra từ offline.</p>
  {:else if query.trim() && results}
    {#if results.user.length}
      <h3>Thẻ & ghi chú của bạn</h3>
      <ul>{#each results.user as h (h.kind + h.id)}
        <li><span class="chip butter">{h.kind === 'note' ? 'Ghi chú' : 'Thẻ'}</span>
          <span class="jp" lang="ja">{h.title}</span> <span class="muted">{h.subtitle}</span></li>
      {/each}</ul>
    {/if}
    {#if results.dictionary.length}
      <h3>Từ điển</h3>
      <ul>{#each results.dictionary as h (h.id)}
        <li><button class="hit" onclick={() => openWord(h.id)}>
          <span class="jp title" lang="ja">{h.title}</span>
          <span class="muted jp" lang="ja">{h.subtitle}</span>
        </button></li>
      {/each}</ul>
    {/if}
    {#if none}<p class="muted">Không tìm thấy “{query.trim()}”.</p>{/if}
  {/if}
</div>

<style>
  input { width: 100%; min-height: 48px; padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-pill);
    background: var(--surface-2); font-size: var(--text-md); }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: .3rem; }
  h3 { margin: var(--space-3) 0 var(--space-1); font-size: var(--text-md); }
  .muted { color: var(--text-muted); }
  .hit { width: 100%; text-align: left; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: .6rem var(--space-3); min-height: 44px; display: flex; gap: var(--space-3); align-items: baseline; flex-wrap: wrap; }
  .title { font-size: 1.3rem; color: var(--accent-strong); }
</style>
