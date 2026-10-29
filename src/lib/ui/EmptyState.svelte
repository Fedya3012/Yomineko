<script lang="ts">
  // "Nothing here yet" panel. Always says what will appear and what to do next (never just "Empty").
  import type { Snippet } from 'svelte';
  import Mochi from './Mochi.svelte';
  let { title, body, children }: { title: string; body: string; children?: Snippet } = $props();
</script>

<section class="empty" aria-labelledby="es-t">
  <Mochi mood="sleepy" size={96} />
  <h2 id="es-t">{title}</h2>
  <p>{body}</p>
  {#if children}<div class="actions">{@render children()}</div>{/if}
</section>

<style>
  .empty { display: grid; justify-items: center; gap: var(--space-3); text-align: center; padding: var(--space-8) var(--space-4); border: 2px dashed var(--border-strong); border-radius: var(--radius-lg); background: var(--surface-2); }
  h2 { margin: 0; font-size: var(--text-lg); }
  p { margin: 0; max-width: 36ch; color: var(--text-muted); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; }
</style>
