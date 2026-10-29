<script lang="ts">
  // Error panel. role="alert" makes screen readers announce it. Plain words: what happened, what to do, retry button.
  import type { Snippet } from 'svelte';
  let { title, body, detail = '', children }: { title: string; body: string; detail?: string; children?: Snippet } = $props();
</script>

<div class="err" role="alert">
  <span class="mark" aria-hidden="true">!</span>
  <div class="txt">
    <strong>{title}</strong>
    <p>{body}</p>
    {#if detail}<details><summary>Chi tiết kỹ thuật</summary><code>{detail}</code></details>{/if}
    {#if children}<div class="actions">{@render children()}</div>{/if}
  </div>
</div>

<style>
  .err { display: flex; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius); background: var(--warn-soft); border: 2px solid var(--warn); color: var(--text); }
  .mark { flex: none; width: 2rem; height: 2rem; border-radius: 50%; display: grid; place-items: center; font-weight: 800; background: var(--warn); color: var(--bg); }
  .txt { display: grid; gap: var(--space-2); min-width: 0; }
  p { margin: 0; }
  summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; }
  code { overflow-wrap: anywhere; font-size: var(--text-sm); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
</style>
