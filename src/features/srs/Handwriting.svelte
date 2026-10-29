<script lang="ts">
  // A drawing pad. It does NOT guess what was written (that would need a big offline model);
  // the learner writes, reveals the answer, compares and rates themselves honestly.
  let { height = 220, label = 'Vùng viết tay' }: { height?: number; label?: string } = $props();

  let canvas: HTMLCanvasElement;
  let strokes = $state<{ x: number; y: number }[][]>([]);
  let drawing = false;

  const ink = () => getComputedStyle(canvas).getPropertyValue('--text').trim() || '#000';

  function redraw() {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = ink();
    for (const s of strokes) {
      ctx.beginPath();
      s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (s.length === 1) ctx.lineTo(s[0].x + 0.1, s[0].y);
      ctx.stroke();
    }
  }

  const point = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.width, y: ((e.clientY - r.top) / r.height) * canvas.height };
  };

  function down(e: PointerEvent) {
    drawing = true; canvas.setPointerCapture(e.pointerId);
    strokes = [...strokes, [point(e)]]; redraw();
  }
  function move(e: PointerEvent) {
    if (!drawing) return;
    strokes[strokes.length - 1].push(point(e)); redraw();
  }
  const up = () => { drawing = false; };

  export function clear() { strokes = []; redraw(); }
  const undoStroke = () => { strokes = strokes.slice(0, -1); redraw(); };
</script>

<div class="pad">
  <canvas bind:this={canvas} width="640" height={Math.round(640 * height / 360)} style="height:{height}px"
    aria-label={label}
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}></canvas>
  <div class="tools">
    <button class="btn soft" type="button" onclick={undoStroke} disabled={!strokes.length}>↶ Xoá nét cuối</button>
    <button class="btn soft" type="button" onclick={clear} disabled={!strokes.length}>Xoá hết</button>
  </div>
</div>

<style>
  .pad { display: grid; gap: var(--space-2); }
  canvas {
    width: 100%; touch-action: none; /* stops the page scrolling while drawing */
    background: var(--bg-sunken); border: 2px dashed var(--border); border-radius: var(--radius);
  }
  .tools { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  .tools .btn:disabled { opacity: .5; cursor: default; }
</style>
