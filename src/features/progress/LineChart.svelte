<script lang="ts">
  import type { SeriesPoint } from './stats';
  let { series }: { series: SeriesPoint[] } = $props();

  const W = 600, H = 180, PAD = 28;
  const lines = [
    { key: 'word', label: 'Từ vựng', color: 'var(--accent)' },
    { key: 'kanji', label: 'Kanji', color: 'var(--info)' },
    { key: 'grammar', label: 'Ngữ pháp', color: 'var(--success)' }
  ] as const;

  const max = $derived(Math.max(1, ...series.flatMap((p) => [p.word, p.kanji, p.grammar])));
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, series.length - 1);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const path = (key: 'word' | 'kanji' | 'grammar') => series.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
</script>

<svg viewBox="0 0 {W} {H}" role="img" aria-label="Biểu đồ số từ, kanji, ngữ pháp đã học theo thời gian">
  <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} class="axis" />
  <line x1={PAD} x2={PAD} y1={PAD} y2={H - PAD} class="axis" />
  <text x={PAD - 4} y={PAD + 4} class="tick" text-anchor="end">{max}</text>
  <text x={PAD - 4} y={H - PAD + 4} class="tick" text-anchor="end">0</text>
  <text x={PAD} y={H - 8} class="tick">{series[0]?.date.slice(5)}</text>
  <text x={W - PAD} y={H - 8} class="tick" text-anchor="end">{series[series.length - 1]?.date.slice(5)}</text>
  {#each lines as l}
    <path d={path(l.key)} fill="none" stroke={l.color} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  {/each}
</svg>
<p class="legend">
  {#each lines as l}<span><i style="background:{l.color}"></i>{l.label}</span>{/each}
</p>

<style>
  svg { width: 100%; height: auto; display: block; }
  .axis { stroke: var(--border); stroke-width: 1.5; }
  .tick { fill: var(--text-muted); font-size: 11px; }
  .legend { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-2) 0 0; font-size: var(--text-sm); color: var(--text-muted); }
  .legend i { display: inline-block; width: .8rem; height: .8rem; border-radius: 50%; margin-right: .35rem; vertical-align: middle; }
</style>
