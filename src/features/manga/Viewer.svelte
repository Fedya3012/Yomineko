<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { DB } from '../../lib/db';
  import { ocrPaths } from './assets';
  import { lookupAt, loadWordIndex, type LookupResult, type WordIndex } from './lookup';
  import { OcrEngine, type OcrMode } from './ocr/engine';
  import { hitTest } from './ocr/hit';
  import type { OcrBlock } from './ocr/types';
  import { PageCache, type LoadedPage } from './pageCache';
  import { DEFAULT_PREFS, loadPosition, loadPrefs, savePosition, savePrefs, type ReaderPrefs } from './position';
  import { buildSpreads, arrowToStep, screenOrder, spreadIndexOf } from './spreads';
  import { dragToRegion, isWidePage, locate, spreadContentSize } from './spreadMath';
  import type { Book } from './types';
  import { addWordToSrs } from '../srs/bridge';
  import { clampPan, clampScale, FIT_VIEW, fitSize, toggleZoom, viewToContent, zoomAt, type View } from './zoom';

  let { book, db, onClose }: { book: Book; db: DB; onClose: () => void } = $props();

  const cache = new PageCache(untrack(() => book).pages);
  const engine = new OcrEngine(ocrPaths());

  let prefs = $state<ReaderPrefs>({ ...DEFAULT_PREFS });
  let current = $state(0);              // page number of the first page of the spread on screen
  let wide = $state<Record<number, boolean>>({});
  let shown = $state<(LoadedPage & { index: number })[]>([]);
  let loadError = $state('');
  let view = $state<View>(FIT_VIEW);
  let stage = $state<HTMLDivElement>();
  let vw = $state(0), vh = $state(0);
  let chrome = $state(true);
  let restored = $state(false);         // don't overwrite the saved position before it has been read

  // OCR
  let ocrMode = $state<OcrMode>('auto');
  let ocrOn = $state(false);
  let ocrBusy = $state('');
  let ocrError = $state('');
  let showBoxes = $state(false);
  let selectRegion = $state(false);
  let blocksByPage = $state<Record<number, OcrBlock[]>>({});
  let words: WordIndex | undefined;
  let picked = $state<{ page: number; block: OcrBlock; result: LookupResult } | undefined>();
  let drag = $state<{ page: number; slot: number; from: { x: number; y: number }; to: { x: number; y: number } } | undefined>();

  const spreads = $derived(buildSpreads(book.pages.length, (p) => !!wide[p], { mode: prefs.mode, coverAlone: prefs.coverAlone }));
  const spreadNo = $derived(spreadIndexOf(spreads, current));
  const spread = $derived(spreads[spreadNo] ?? [0]);
  const content = $derived(shown.length ? spreadContentSize(shown) : { w: 1, h: 1 });
  const box = $derived(fitSize(content, { w: vw, h: vh }));
  const lastPage = $derived(Math.max(...spread));
  const atStart = $derived(spreadNo === 0);
  const atEnd = $derived(spreadNo >= spreads.length - 1);

  onMount(async () => {
    prefs = await loadPrefs(db);
    current = await loadPosition(db, book.id, book.pages.length);
    restored = true;
  });

  onDestroy(() => {
    cache.dispose();
    void engine.dispose();
    book.close();
  });

  // Load the pictures for the spread on screen, then warm up the neighbours.
  $effect(() => {
    const pages = spread;
    let cancelled = false;
    loadError = '';
    Promise.all(pages.map(async (index) => ({ ...(await cache.get(index)), index })))
      .then((loaded) => {
        if (cancelled) return;
        // Learning that a page is wide can re-pair the book (double mode); the effect then re-runs from cache.
        for (const p of loaded) {
          const w = isWidePage(p);
          if (wide[p.index] !== w) wide[p.index] = w;
        }
        shown = screenOrder(pages, prefs.direction).map((i) => loaded.find((p) => p.index === i)!);
        view = FIT_VIEW;
        picked = undefined;
        cache.trim(pages[0]);
        const next = spreads[spreadNo + 1]?.[0];
        if (next !== undefined) cache.get(next).catch(() => {});
      })
      .catch((e) => { if (!cancelled) loadError = e instanceof Error ? e.message : String(e); });
    return () => { cancelled = true; };
  });

  $effect(() => { if (restored) void savePosition(db, book.id, spread[0]); });

  function go(step: 1 | -1) {
    const target = spreads[spreadNo + step];
    if (target) current = target[0];
  }
  const goTo = (page: number) => { current = Math.min(Math.max(0, page), book.pages.length - 1); };

  function setPrefs(patch: Partial<ReaderPrefs>) {
    const keep = spread[0];
    prefs = { ...prefs, ...patch };
    current = keep;
    void savePrefs(db, $state.snapshot(prefs)); // IndexedDB cannot clone a reactive proxy
  }

  // ---------- zoom / pan / tap ----------
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { moved: boolean; startX: number; startY: number; startedAt: number; pinch?: { dist: number; scale: number } } | undefined;
  let lastTap = { t: 0, x: 0, y: 0 };
  let tapTimer: ReturnType<typeof setTimeout> | undefined;

  const centred = (e: { clientX: number; clientY: number }) => {
    const r = stage!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };
  const setView = (v: View) => (view = clampPan(v, { w: vw, h: vh }, box));

  /** Screen point -> which page is under it, in that page's own pixels. */
  function pageAt(p: { x: number; y: number }) {
    const { u, v } = viewToContent(view, box, p.x, p.y);
    const hit = locate(shown, u, v);
    return hit && { ...hit, index: shown[hit.slot].index };
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.sheet')) return;
    stage!.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, centred(e));
    if (selectRegion && pointers.size === 1) {
      const hit = pageAt(centred(e));
      if (hit) drag = { page: hit.index, slot: hit.slot, from: { x: hit.x, y: hit.y }, to: { x: hit.x, y: hit.y } };
    }
    if (pointers.size === 1) gesture = { moved: false, startX: e.clientX, startY: e.clientY, startedAt: performance.now() };
    if (pointers.size === 2 && gesture) {
      const [a, b] = [...pointers.values()];
      gesture.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      gesture.moved = true;
      drag = undefined;
    }
  }

  function onPointerMove(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !gesture) return;
    const now = centred(e);
    pointers.set(e.pointerId, now);
    if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > 8) gesture.moved = true;

    if (gesture.pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setView(zoomAt(view, clampScale(gesture.pinch.scale * (dist / gesture.pinch.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2));
    } else if (drag) {
      const hit = pageAt(now);
      if (hit && hit.index === drag.page) drag = { ...drag, to: { x: hit.x, y: hit.y } };
    } else if (view.scale > 1 && gesture.moved) {
      setView({ ...view, x: view.x + now.x - prev.x, y: view.y + now.y - prev.y });
    }
  }

  function onPointerUp(e: PointerEvent) {
    const wasTap = gesture && !gesture.moved && performance.now() - gesture.startedAt < 500 && pointers.size === 1;
    const at = centred(e);
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (drag) { void scanRegion(drag); drag = undefined; }
      else if (wasTap) handleTap(at, e);
      gesture = undefined;
    }
  }

  function handleTap(at: { x: number; y: number }, e: PointerEvent) {
    const now = performance.now();
    const isDouble = now - lastTap.t < 300 && Math.hypot(at.x - lastTap.x, at.y - lastTap.y) < 40;
    lastTap = { t: now, x: at.x, y: at.y };
    clearTimeout(tapTimer);
    if (isDouble) { setView(toggleZoom(view, at.x, at.y)); lastTap.t = 0; return; }

    // Tap on recognised text: show its meaning straight away.
    if (ocrOn) {
      const hit = pageAt(at);
      const blocks = hit && blocksByPage[hit.index];
      const ch = hit && blocks && hitTest(blocks, hit.x, hit.y);
      if (hit && ch) { void showMeaning(hit.index, ch.block, ch.index); return; }
    }
    if (picked) { picked = undefined; return; }

    // Edges turn the page (after a short wait in case this is the first half of a double-tap); the middle toggles the toolbar.
    const r = stage!.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    tapTimer = setTimeout(() => {
      if (view.scale > 1.05 || (f >= 0.3 && f <= 0.7)) { chrome = !chrome; return; }
      const rightIsNext = prefs.direction === 'ltr';
      go((f > 0.5) === rightIsNext ? 1 : -1);
    }, 300);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      setView(zoomAt(view, view.scale * Math.exp(-e.deltaY / 300), centred(e).x, centred(e).y));
    } else if (view.scale > 1.05) {
      setView({ ...view, x: view.x - e.deltaX, y: view.y - e.deltaY });
    } else if (Math.abs(e.deltaY) > 20) {
      go(e.deltaY > 0 ? 1 : -1);
    }
  }

  function onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).matches?.('input, select, textarea')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') go(arrowToStep(e.key, prefs.direction));
    else if (e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1); }
    else if (e.key === 'PageUp') go(-1);
    else if (e.key === '+' || e.key === '=') setView(zoomAt(view, view.scale * 1.25, 0, 0));
    else if (e.key === '-') setView(zoomAt(view, view.scale / 1.25, 0, 0));
    else if (e.key === '0') view = FIT_VIEW;
    else if (e.key === 'Escape') { picked = undefined; selectRegion = false; }
  }

  // ---------- OCR ----------
  async function scanPage(index: number, region?: { x0: number; y0: number; x1: number; y1: number }) {
    const page = await cache.get(index);
    const found = await engine.recognize(page.blob, { mode: ocrMode, region });
    if (!region) { blocksByPage[index] = found; return; }
    // A region scan replaces only the text that was inside the region.
    const outside = (blocksByPage[index] ?? []).filter((b) => b.box.x1 < region.x0 || b.box.x0 > region.x1 || b.box.y1 < region.y0 || b.box.y0 > region.y1);
    blocksByPage[index] = [...outside, ...found].map((b, id) => ({ ...b, id }));
  }

  async function runOcr(task: () => Promise<void>, message: string) {
    if (ocrBusy) return;
    ocrOn = true; ocrError = ''; ocrBusy = message;
    try { await task(); }
    catch (e) { ocrError = 'OCR gặp lỗi: ' + (e instanceof Error ? e.message : String(e)); }
    finally { ocrBusy = ''; }
  }

  const scanSpread = () => runOcr(async () => { for (const i of spread) await scanPage(i); }, 'Đang đọc chữ trên trang…');

  function scanRegion(d: NonNullable<typeof drag>) {
    const page = shown.find((p) => p.index === d.page)!;
    const region = dragToRegion(d.from, d.to, page);
    selectRegion = false;
    if (region) return runOcr(() => scanPage(d.page, region), 'Đang đọc vùng đã chọn…');
  }

  async function showMeaning(page: number, block: OcrBlock, index: number) {
    words ??= await loadWordIndex(db);
    const result = lookupAt(words, block, index);
    picked = { page, block, result };
  }

  let cardMsg = $state('');
  async function makeCard() {
    const r = picked?.result; const e = r?.entries[0];
    if (!picked || !r || !e) return;
    const added = await addWordToSrs(db, {
      wordId: e.id, word: e.kanji ?? e.reading, reading: e.reading, meaning: e.meaning,
      sentence: picked.block.text, blank: r.surface, kind: 'manga', origin: book.title
    });
    cardMsg = added ? `Đã thêm “${e.kanji ?? e.reading}” vào thẻ ôn.` : 'Từ này đã có trong thẻ ôn rồi.';
  }
  $effect(() => { picked; cardMsg = ''; });

  const toggleOcr = () => (ocrOn ? (ocrOn = false, picked = undefined) : scanSpread());

  /** Highlight rectangles (page pixels) of the characters being explained. */
  const highlight = (pageIndex: number) => {
    if (!picked || picked.page !== pageIndex) return [];
    const { block, result } = picked;
    return block.chars.slice(result.start, result.start + result.length).map((c) => c.box);
  };
</script>

<svelte:window onkeydown={onKey} />

<div class="viewer" class:hide-chrome={!chrome}>
  <div class="bar top card">
    <button class="btn soft" onclick={onClose} aria-label="Đóng truyện">← Thư viện</button>
    <strong class="title">{book.title}</strong>
    <span class="muted count">{lastPage + 1} / {book.pages.length}</span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="stage" class:selecting={selectRegion} bind:this={stage} bind:clientWidth={vw} bind:clientHeight={vh}
    onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={onPointerUp}
    onwheel={onWheel}>
    {#if loadError}
      <p class="msg" role="alert">Không mở được trang này: {loadError}</p>
    {:else if !shown.length}
      <p class="msg">Đang mở trang…</p>
    {:else}
      <div class="spread" style:width="{box.w}px" style:height="{box.h}px"
        style:transform="translate({view.x}px, {view.y}px) scale({view.scale})">
        {#each shown as p (p.index)}
          <div class="page">
            <img src={p.url} alt="Trang {p.index + 1}" draggable="false" />
            <svg viewBox="0 0 {p.width} {p.height}" preserveAspectRatio="none" aria-hidden="true">
              {#if showBoxes}
                {#each blocksByPage[p.index] ?? [] as b (b.id)}
                  <rect class="blk" x={b.box.x0} y={b.box.y0} width={b.box.x1 - b.box.x0} height={b.box.y1 - b.box.y0} />
                {/each}
              {/if}
              {#each highlight(p.index) as c}
                <rect class="hl" x={c.x0} y={c.y0} width={c.x1 - c.x0} height={c.y1 - c.y0} rx="6" />
              {/each}
              {#if drag && drag.page === p.index}
                <rect class="sel" x={Math.min(drag.from.x, drag.to.x)} y={Math.min(drag.from.y, drag.to.y)}
                  width={Math.abs(drag.to.x - drag.from.x)} height={Math.abs(drag.to.y - drag.from.y)} />
              {/if}
            </svg>
          </div>
        {/each}
      </div>
    {/if}
    {#if ocrBusy}<p class="busy card" role="status">{ocrBusy}</p>{/if}
  </div>

  {#if picked}
    <div class="sheet card" role="dialog" aria-label="Nghĩa của chữ đã chạm">
      <div class="sheet-head">
        <ruby class="jp word" lang="ja">{picked.result.surface}<rt>{picked.result.entries[0]?.kanji ? picked.result.entries[0].reading : ''}</rt></ruby>
        <button class="btn soft" onclick={() => (picked = undefined)} aria-label="Đóng">✕</button>
      </div>
      {#if picked.result.entries.length}
        <ul class="meanings">
          {#each picked.result.entries as e (e.id)}
            <li><span class="jp" lang="ja">{e.kanji ?? e.reading}{e.kanji ? `（${e.reading}）` : ''}</span> — {e.meaning}</li>
          {/each}
        </ul>
        <p class="card-row"><button class="btn" onclick={makeCard}>+ Tạo thẻ ôn</button>
          {#if cardMsg}<span role="status" class="muted small">{cardMsg}</span>{/if}</p>
      {:else}
        <p class="muted">Chưa có nghĩa của “{picked.result.surface}” trong từ điển offline. Hãy cài gói từ điển (JMdict) để xem nghĩa đầy đủ.</p>
      {/if}
      <p class="muted small">Cả câu — chạm một chữ để tra lại:</p>
      <p class="sentence jp" class:vertical-text={picked.block.orientation === 'vertical'} lang="ja">
        {#each picked.block.chars as c, i}
          <button class="ch" class:on={i >= picked.result.start && i < picked.result.start + picked.result.length}
            onclick={() => picked && showMeaning(picked.page, picked.block, i)}>{c.ch}</button>
        {/each}
      </p>
    </div>
  {/if}

  <div class="bar bottom card">
    <div class="row">
      <button class="btn soft" onclick={() => go(prefs.direction === 'rtl' ? 1 : -1)} disabled={prefs.direction === 'rtl' ? atEnd : atStart} aria-label="Trang bên trái">◀</button>
      <input class="slider" type="range" min="1" max={book.pages.length} value={spread[0] + 1} aria-label="Chọn trang"
        style:direction={prefs.direction === 'rtl' ? 'rtl' : 'ltr'}
        oninput={(e) => goTo(+e.currentTarget.value - 1)} />
      <button class="btn soft" onclick={() => go(prefs.direction === 'rtl' ? -1 : 1)} disabled={prefs.direction === 'rtl' ? atStart : atEnd} aria-label="Trang bên phải">▶</button>
    </div>
    <div class="row tools">
      <button class="btn soft" onclick={() => setView(zoomAt(view, view.scale / 1.5, 0, 0))} aria-label="Thu nhỏ">−</button>
      <button class="btn soft" onclick={() => (view = FIT_VIEW)}>{Math.round(view.scale * 100)}%</button>
      <button class="btn soft" onclick={() => setView(zoomAt(view, view.scale * 1.5, 0, 0))} aria-label="Phóng to">+</button>
      <button class="btn soft" aria-pressed={prefs.mode === 'double'} onclick={() => setPrefs({ mode: prefs.mode === 'double' ? 'single' : 'double' })}>
        {prefs.mode === 'double' ? '2 trang' : '1 trang'}
      </button>
      <button class="btn soft" onclick={() => setPrefs({ direction: prefs.direction === 'rtl' ? 'ltr' : 'rtl' })}
        title="Chiều đọc">{prefs.direction === 'rtl' ? '← Phải sang trái' : 'Trái sang phải →'}</button>
      {#if prefs.mode === 'double'}
        <label class="chk"><input type="checkbox" checked={prefs.coverAlone} onchange={(e) => setPrefs({ coverAlone: e.currentTarget.checked })} /> Bìa riêng</label>
      {/if}
    </div>
    <div class="row tools ocr">
      <button class="btn" aria-pressed={ocrOn} onclick={toggleOcr} disabled={!!ocrBusy}>{ocrOn ? 'Tắt OCR' : 'Đọc chữ (OCR)'}</button>
      {#if ocrOn}
        <button class="btn soft" onclick={scanSpread} disabled={!!ocrBusy}>Quét lại trang</button>
        <button class="btn soft" aria-pressed={selectRegion} onclick={() => (selectRegion = !selectRegion)} disabled={!!ocrBusy}>
          {selectRegion ? 'Kéo để chọn vùng…' : 'Chọn vùng chữ'}
        </button>
        <label class="chk">Kiểu chữ
          <select bind:value={ocrMode}>
            <option value="auto">Tự nhận</option><option value="vertical">Dọc</option><option value="horizontal">Ngang</option>
          </select>
        </label>
        <label class="chk"><input type="checkbox" bind:checked={showBoxes} /> Hiện khung chữ</label>
      {/if}
    </div>
    {#if ocrError}<p class="err" role="alert">{ocrError}</p>{/if}
    {#if ocrOn && !ocrBusy && !ocrError && spread.every((i) => !(blocksByPage[i]?.length))}
      <p class="muted small">Không thấy chữ Nhật nào. Thử “Chọn vùng chữ” quanh khung thoại, hoặc đổi kiểu chữ.</p>
    {:else if ocrOn && !ocrBusy}
      <p class="muted small">Chạm vào một chữ trên trang để xem nghĩa.</p>
    {/if}
  </div>
</div>

<style>
  .viewer { position: fixed; inset: 0; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); display: flex; flex-direction: column; background: var(--bg-sunken); z-index: 20; }
  .bar { margin: var(--space-2); padding: var(--space-2) var(--space-3); display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
  .top .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .count { font-variant-numeric: tabular-nums; }
  .hide-chrome .bar { display: none; }
  .row { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; width: 100%; }
  .tools { justify-content: center; }
  .slider { flex: 1; min-width: 6rem; min-height: 44px; accent-color: var(--accent); }
  .chk { display: inline-flex; gap: var(--space-1); align-items: center; font-size: var(--text-sm); }
  select { min-height: 44px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text); padding: 0 var(--space-2); }
  .stage { flex: 1; min-height: 0; position: relative; overflow: hidden; touch-action: none; display: grid; place-items: center; user-select: none; cursor: grab; }
  .stage.selecting { cursor: crosshair; }
  .spread { display: flex; transform-origin: center; will-change: transform; }
  .page { position: relative; flex: 1 1 0; min-width: 0; height: 100%; }
  .page img { width: 100%; height: 100%; object-fit: fill; display: block; pointer-events: none; }
  .page svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .blk { fill: none; stroke: var(--info); stroke-width: 3; stroke-dasharray: 10 6; }
  .hl { fill: var(--butter-500); fill-opacity: .45; stroke: var(--accent-strong); stroke-width: 3; }
  .sel { fill: var(--accent); fill-opacity: .2; stroke: var(--accent-strong); stroke-width: 4; stroke-dasharray: 12 8; }
  .msg { color: var(--text-muted); padding: var(--space-4); text-align: center; }
  .busy { position: absolute; top: var(--space-3); left: 50%; transform: translateX(-50%); margin: 0; padding: var(--space-2) var(--space-4); }
  .err { color: var(--accent-strong); margin: 0; }
  .small { font-size: var(--text-sm); margin: 0; }
  /* in the flow (not floating) so the page shrinks above it and the highlighted word stays visible */
  .sheet { margin: 0 var(--space-2); max-height: 40vh; overflow: auto; padding: var(--space-3) var(--space-4); }
  .card-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin: var(--space-2) 0; }
  .sheet-head { display: flex; justify-content: space-between; align-items: center; }
  .word { font-size: calc(2.2rem * var(--font-scale)); color: var(--accent-strong); }
  .meanings { margin: var(--space-2) 0; padding-left: 1.2rem; }
  .sentence { margin: var(--space-1) 0 0; display: flex; flex-wrap: wrap; gap: 2px; font-size: var(--text-jp-reading); }
  .ch { min-width: 44px; min-height: 44px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; cursor: pointer; }
  .ch.on { background: var(--butter-100); border-color: var(--accent); color: #4a3548; }
</style>
