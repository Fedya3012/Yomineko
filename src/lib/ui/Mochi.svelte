<script lang="ts">
  // Mochi the white cat. Original artwork, easy to swap; standalone copies live in src/assets/illustrations.
  // `mood` changes the face only. Mochi stays white in both themes; dark mode adds a cream halo so the ink outline still reads.
  // Decorative by default (aria-hidden); pass `label` when Mochi carries meaning.
  let { size = 96, mood = 'happy', label = '' }: { size?: number; mood?: 'happy' | 'sleepy' | 'cheer' | 'sad'; label?: string } = $props();
  const head = 'M22 50 26 12 52 32Q64 29 76 32L102 12 106 50Q114 64 110 80 102 104 64 104 26 104 18 80 14 64 22 50Z';
</script>

<svg viewBox="0 0 128 112" width={size} height={Math.round(size * 0.875)} role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}>
  <path class="halo" d={head} fill="none" stroke-width="10" stroke-linejoin="round" />
  <path d={head} fill="#fffdf8" stroke="#0f3640" stroke-width="4" stroke-linejoin="round" />
  <path d="M31 24 46 36 34 42ZM97 24 82 36 94 42Z" fill="#f4b6c2" />
  {#if mood === 'sleepy'}
    <path d="M40 62q7 6 14 0M74 62q7 6 14 0" fill="none" stroke="#0f3640" stroke-width="4" stroke-linecap="round" />
  {:else if mood === 'cheer'}
    <path d="M40 64q7-8 14 0M74 64q7-8 14 0" fill="none" stroke="#0f3640" stroke-width="4" stroke-linecap="round" />
  {:else}
    <ellipse cx="47" cy="62" rx="5" ry="6" fill="#0f3640" /><ellipse cx="81" cy="62" rx="5" ry="6" fill="#0f3640" />
    <circle cx="49" cy="60" r="1.6" fill="#fff" /><circle cx="83" cy="60" r="1.6" fill="#fff" />
    {#if mood === 'sad'}<path d="M38 56l12-5M90 56l-12-5" stroke="#0f3640" stroke-width="3.5" stroke-linecap="round" />{/if}
  {/if}
  {#if mood === 'cheer'}
    <path d="M57 72q7 10 14 0z" fill="#ee7d6c" stroke="#0f3640" stroke-width="3.5" stroke-linejoin="round" />
  {:else if mood === 'sad'}
    <path d="M58 76q6-5 12 0" fill="none" stroke="#0f3640" stroke-width="4" stroke-linecap="round" />
  {:else}
    <path d="M58 74q6 6 12 0" fill="none" stroke="#0f3640" stroke-width="4" stroke-linecap="round" />
  {/if}
  <ellipse cx="36" cy="76" rx="8" ry="5" fill="#f4b6c2" /><ellipse cx="92" cy="76" rx="8" ry="5" fill="#f4b6c2" />
  <path class="whisk" d="M6 70h16M8 82l14-5M122 70h-16M120 82l-14-5" stroke-width="3" stroke-linecap="round" />
</svg>

<style>
  .halo { stroke: transparent; }
  .whisk { stroke: var(--ink); }
  :global(:root[data-theme='dark']) .halo { stroke: #e8dcc6; }
</style>
