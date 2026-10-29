<script lang="ts">
  // Round "sticker" badge: wobbly hand-drawn ring around a glyph. Reference: Fedya's icon moodboard.
  // `tone` picks the ring colour; `children` is the inner icon (inline SVG using currentColor / --ink).
  import type { Snippet } from 'svelte';
  let { tone = 'coral', size = 64, label = '', children }:
    { tone?: 'coral' | 'teal' | 'mint' | 'sky'; size?: number; label?: string; children: Snippet } = $props();
</script>

<span class="badge" style="--s:{size}px; --ring:var(--badge-{tone})" role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <defs>
      <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
        <feDisplacementMap in="SourceGraphic" scale="4" />
      </filter>
    </defs>
    <circle cx="50" cy="50" r="44" fill="var(--surface)" stroke="var(--ring)" stroke-width="5" filter="url(#wobble)" />
  </svg>
  <span class="glyph">{@render children()}</span>
</span>

<style>
  .badge { position: relative; display: inline-grid; place-items: center; width: var(--s); height: var(--s); flex: none; }
  svg { position: absolute; inset: 0; }
  .glyph { position: relative; width: 56%; height: 56%; color: var(--ink); display: grid; place-items: center; }
  .glyph :global(svg) { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
</style>
