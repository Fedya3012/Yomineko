<script lang="ts">
  // Hoạt hình thứ tự nét: các nét xám là khung chữ, nét màu được vẽ dần từng nét một.
  import { onDestroy } from 'svelte';
  let { strokes, size = 200, label = 'Thứ tự nét' }: { strokes: string[]; size?: number; label?: string } = $props();

  const MS_PER_STROKE = 650;
  let progress = $state(0);           // 0..strokes.length, phần lẻ là nét đang vẽ dở
  let playing = $state(false);
  let raf = 0, last = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tick(now: number) {
    progress = Math.min(strokes.length, progress + (now - last) / MS_PER_STROKE);
    last = now;
    if (progress >= strokes.length) { playing = false; return; }
    raf = requestAnimationFrame(tick);
  }
  export function play() {
    cancelAnimationFrame(raf);
    if (reduced) { progress = strokes.length; return; }
    progress = 0; playing = true; last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function step() {
    cancelAnimationFrame(raf); playing = false;
    progress = Math.floor(progress) >= strokes.length ? 1 : Math.floor(progress) + 1;
  }
  $effect(() => { strokes; play(); });
  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="anim">
  <svg viewBox="0 0 109 109" width={size} height={size} role="img" aria-label={label}>
    <path class="guide" d="M54.5 4v101M4 54.5h101" />
    {#each strokes as d}<path class="ghost" {d} />{/each}
    {#each strokes as d, i}
      <path class="ink" {d} pathLength="1" stroke-dasharray="1" stroke-dashoffset={1 - Math.max(0, Math.min(1, progress - i))} />
    {/each}
  </svg>
  <div class="row">
    <button class="btn soft" onclick={play} disabled={playing}>▶ Xem lại</button>
    <button class="btn soft" onclick={step}>Từng nét ({Math.min(Math.ceil(progress), strokes.length)}/{strokes.length})</button>
  </div>
</div>

<style>
  .anim { display: grid; justify-items: center; gap: var(--space-2); }
  svg { background: var(--surface-2); border-radius: var(--radius); border: 1px solid var(--border); max-width: 100%; height: auto; }
  .guide { stroke: var(--border); stroke-width: .6; stroke-dasharray: 3 3; fill: none; }
  .ghost { stroke: var(--border); stroke-width: 4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .ink { stroke: var(--accent-strong); stroke-width: 4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .row { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; }
  button:disabled { opacity: .6; }
</style>
