<script lang="ts">
  // Mochi the white cat. Original artwork, easy to swap. `mood` changes the face only.
  // Decorative by default (aria-hidden); pass `label` when Mochi carries meaning.
  let { size = 96, mood = 'happy', label = '' }: { size?: number; mood?: 'happy' | 'sleepy' | 'cheer'; label?: string } = $props();
</script>

<svg viewBox="0 0 128 128" width={size} height={size} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
  <path d="M30 52 L34 22 L54 38 Q64 36 74 38 L94 22 L98 52 Q104 62 102 76 Q98 100 64 102 Q30 100 26 76 Q24 62 30 52Z" fill="var(--mochi-fur, #fffaf5)" stroke="var(--mochi-line, #e58aa5)" stroke-width="4" stroke-linejoin="round" />
  <path d="M38 34 L48 42 L40 48Z M90 34 L80 42 L88 48Z" fill="#ffb8c9" opacity=".8" />
  {#if mood === 'sleepy'}
    <path d="M42 68 Q50 74 58 68 M70 68 Q78 74 86 68" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" />
  {:else if mood === 'cheer'}
    <path d="M42 70 Q50 60 58 70 M70 70 Q78 60 86 70" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" />
  {:else}
    <circle cx="50" cy="68" r="5" fill="var(--ink)" /><circle cx="78" cy="68" r="5" fill="var(--ink)" />
  {/if}
  <path d="M60 80 Q64 85 68 80" fill="none" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round" />
  <circle cx="40" cy="80" r="6" fill="#ffb8c9" opacity=".7" /><circle cx="88" cy="80" r="6" fill="#ffb8c9" opacity=".7" />
</svg>
