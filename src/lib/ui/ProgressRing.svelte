<script lang="ts">
  // Circular progress, used for daily goal and JLPT level. `value` 0..1.
  import type { Snippet } from 'svelte';
  let { value, size = 96, label = '', children }: { value: number; size?: number; label?: string; children?: Snippet } = $props();
  const r = 42, c = 2 * Math.PI * r;
  const v = $derived(Math.min(1, Math.max(0, value)));
</script>

<span class="ring" style="--s:{size}px" role="img" aria-label="{label} {Math.round(v * 100)}%">
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent-soft)" stroke-width="10" />
    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent-gfx)" stroke-width="10" stroke-linecap="round"
      stroke-dasharray={c} stroke-dashoffset={c * (1 - v)} transform="rotate(-90 50 50)" />
  </svg>
  <span class="inner">{#if children}{@render children()}{:else}{Math.round(v * 100)}%{/if}</span>
</span>

<style>
  .ring { position: relative; display: inline-grid; place-items: center; width: var(--s); height: var(--s); flex: none; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .inner { position: relative; font-weight: 800; font-size: var(--text-md); text-align: center; line-height: 1.1; }
</style>
