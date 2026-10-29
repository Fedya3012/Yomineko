<script lang="ts">
  // Bảng viết tay: người học viết từng nét, mỗi nét được chấm ngay theo nét chuẩn của KanjiVG.
  import type { Point } from './types';
  import { CANVAS, judgeStroke, summarize, type Reason } from './scoring';

  let { strokes, size = 280, onfinish }: {
    strokes: string[]; size?: number;
    onfinish?: (result: { score: number; stars: 0 | 1 | 2 | 3 }) => void;
  } = $props();

  let svg: SVGSVGElement;
  let accepted = $state<{ points: Point[]; score: number }[]>([]);
  let current = $state<Point[]>([]);
  let rejected = $state<Point[] | null>(null);
  let message = $state('Viết nét đầu tiên nhé!');
  let tone = $state<'info' | 'good' | 'bad'>('info');
  let mistakes = $state(0);
  let failsOnStroke = $state(0);
  let showGuide = $state(true);
  let result = $state<{ score: number; stars: 0 | 1 | 2 | 3 } | null>(null);
  let drawing = false;

  const expected = $derived(accepted.length);
  // Sau 3 lần sai liên tiếp ở một nét, tự hiện gợi ý nét đó.
  const hint = $derived(!result && (showGuide || failsOnStroke >= 3));
  const path = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

  const WHY: Record<Reason, string> = {
    ok: 'Đẹp lắm!',
    'too-short': 'Nét hơi ngắn, kéo dài thêm nhé.',
    'wrong-direction': 'Nét đúng hình nhưng ngược chiều, thử viết từ đầu kia nhé.',
    'wrong-shape': 'Chưa khớp, thử lại nhé.'
  };

  function toPoint(e: PointerEvent): Point {
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CANVAS, y: ((e.clientY - r.top) / r.height) * CANVAS };
  }
  function down(e: PointerEvent) {
    if (result) return;
    svg.setPointerCapture(e.pointerId);
    drawing = true; rejected = null; current = [toPoint(e)];
  }
  function move(e: PointerEvent) { if (drawing) current = [...current, toPoint(e)]; }
  function up() {
    if (!drawing) return;
    drawing = false;
    const user = current; current = [];
    const j = judgeStroke(user, strokes, expected, new Set(accepted.map((_, i) => i)));
    if (j.pass) {
      accepted = [...accepted, { points: user, score: j.score }];
      failsOnStroke = 0; tone = 'good';
      if (accepted.length === strokes.length) finish();
      else message = `${WHY.ok} Nét ${accepted.length + 1}/${strokes.length} nào.`;
    } else {
      mistakes++; failsOnStroke++; tone = 'bad'; rejected = user;
      message = j.matchedIndex !== undefined
        ? `Đó là nét thứ ${j.matchedIndex + 1}. Hãy viết nét thứ ${expected + 1} trước nhé.`
        : WHY[j.reason];
      setTimeout(() => { if (rejected === user) rejected = null; }, 700);
    }
  }
  function finish() {
    result = summarize(accepted.map((a) => a.score), mistakes);
    message = result.stars === 0 ? 'Gần được rồi, thử lại nhé!' : `Hoàn thành! ${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)} (${result.score} điểm)`;
    tone = result.stars ? 'good' : 'bad';
    onfinish?.(result);
  }
  export function reset() {
    accepted = []; current = []; rejected = null; mistakes = 0; failsOnStroke = 0; result = null;
    message = 'Viết nét đầu tiên nhé!'; tone = 'info';
  }
  $effect(() => { strokes; reset(); });
</script>

<div class="pad">
  <svg bind:this={svg} viewBox="0 0 109 109" width={size} height={size} class:locked={!!result}
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="application"
    aria-label="Khung viết tay. Dùng ngón tay hoặc chuột để viết từng nét theo thứ tự.">
    <path class="grid" d="M54.5 4v101M4 54.5h101" />
    {#if hint}
      {#each strokes as d, i}
        {#if i >= expected}<path class="ghost" class:next={i === expected} {d} />{/if}
      {/each}
    {/if}
    {#each accepted as a}<path class="done" d={path(a.points)} />{/each}
    {#if rejected}<path class="bad" d={path(rejected)} />{/if}
    {#if current.length}<path class="live" d={path(current)} />{/if}
  </svg>
  <p class="msg {tone}" role="status">{message}</p>
  <div class="row">
    <label class="toggle"><input type="checkbox" bind:checked={showGuide} /> Hiện nét gợi ý</label>
    <button class="btn soft" onclick={reset}>Viết lại</button>
  </div>
</div>

<style>
  .pad { display: grid; justify-items: center; gap: var(--space-2); }
  svg { background: var(--surface); border: 2px solid var(--accent-soft); border-radius: var(--radius); touch-action: none; cursor: crosshair; max-width: 100%; height: auto; }
  svg.locked { cursor: default; }
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .grid { stroke: var(--border); stroke-width: .6; stroke-dasharray: 3 3; }
  .ghost { stroke: var(--border); stroke-width: 4; }
  .ghost.next { stroke: var(--lavender-500); stroke-width: 4.5; opacity: .75; }
  .done { stroke: var(--text); stroke-width: 4; }
  .live { stroke: var(--accent-strong); stroke-width: 4; }
  .bad { stroke: #d9534f; stroke-width: 4; opacity: .8; }
  .msg { margin: 0; min-height: 1.6em; text-align: center; font-weight: 700; }
  .msg.good { color: var(--success); } .msg.bad { color: #c0453f; } .msg.info { color: var(--text-muted); }
  .row { display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; justify-content: center; }
  .toggle { display: inline-flex; gap: var(--space-2); align-items: center; padding: 0; }
</style>
