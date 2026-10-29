<script lang="ts">
  // Pill button. `variant`: solid (main action), soft (secondary), ghost (tertiary), good/again style for SRS grades.
  import type { Snippet } from 'svelte';
  let { variant = 'solid', size = 'md', disabled = false, onclick, children, ...rest }:
    { variant?: 'solid' | 'soft' | 'ghost'; size?: 'md' | 'lg'; disabled?: boolean; onclick?: (e: MouseEvent) => void; children: Snippet; [k: string]: unknown } = $props();
</script>

<button class="btn {variant} {size}" {disabled} {onclick} {...rest}>{@render children()}</button>

<style>
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2); border: 2px solid transparent; border-radius: var(--radius-pill);
    padding: .55rem 1.2rem; min-height: 44px; font-weight: 800; font-size: var(--text-md); background: var(--accent); color: var(--on-accent); transition: transform .12s, background .2s; }
  .btn:active { transform: scale(.97); }
  .btn.lg { min-height: 56px; padding: .8rem 1.8rem; font-size: var(--text-lg); }
  .soft { background: var(--accent-soft); color: var(--accent-strong); }
  .ghost { background: transparent; border-color: var(--border-strong); color: var(--text); }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
