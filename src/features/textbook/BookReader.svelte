<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { PDFDocumentProxy } from 'pdfjs-dist';
  import type { DB } from '../../lib/db';
  import { clearBookRef, lessonAt, loadBookFile, loadBookMeta, loadBookRef, saveBookRef, type BookFileMeta } from './bookfile';
  import { parseEpub, type EpubBook } from './epub';
  import type { Lesson, Textbook } from './types';

  let { db, book, lessons, startLesson, onback, onopenlesson }:
    { db: DB; book: Textbook; lessons: Lesson[]; startLesson?: Lesson; onback: () => void; onopenlesson: (l: Lesson) => void } = $props();

  let meta = $state<BookFileMeta>();
  let error = $state('');
  let loading = $state(true);
  let pos = $state(1);            // page (PDF) or chapter (EPUB), 1-based
  let total = $state(0);
  let links = $state<{ lessonId: string; at: number }[]>([]);
  let canvas = $state<HTMLCanvasElement>();
  let srcdoc = $state('');
  let jump = $state('1');
  let linkNote = $state('');

  // loaded document handles (kept out of reactive state: they are big objects)
  let pdf: PDFDocumentProxy | undefined;
  let epub: EpubBook | undefined;
  let renderToken = 0;

  const kindRef = (n: number) => (meta?.kind === 'pdf' ? { page: n } : { chapter: n });
  const posOf = (r?: { page?: number; chapter?: number }) => (meta?.kind === 'pdf' ? r?.page : r?.chapter);
  const here = $derived(lessonAt(links, pos));
  const hereLesson = $derived(lessons.find((l) => l.id === here));

  async function loadLinks() {
    const out: { lessonId: string; at: number }[] = [];
    for (const l of lessons) { const at = posOf(await loadBookRef(db, l)); if (at) out.push({ lessonId: l.id, at }); }
    links = out;
  }

  onMount(async () => {
    try {
      meta = await loadBookMeta(db, book.id);
      const blob = await loadBookFile(db, book.id);
      if (!meta || !blob) throw new Error('Chưa có file sách. Hãy nạp file PDF hoặc EPUB của bạn.');
      if (meta.kind === 'pdf') {
        const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        pdf = doc;
        total = doc.numPages;
      } else {
        epub = parseEpub(new Uint8Array(await blob.arrayBuffer()));
        total = epub.chapters.length;
      }
      await loadLinks();
      const start = startLesson ? posOf(await loadBookRef(db, startLesson)) : undefined;
      loading = false;
      await go(start ?? 1);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      loading = false;
    }
  });
  onDestroy(() => { pdf?.cleanup(); });

  async function go(n: number) {
    n = Math.min(Math.max(1, Math.round(n) || 1), total || 1);
    pos = n; jump = String(n); linkNote = '';
    const token = ++renderToken;
    if (epub) { srcdoc = epub.chapterHtml(n - 1); return; }
    if (!pdf) return;
    const page = await pdf.getPage(n);
    if (token !== renderToken || !canvas) return;
    const width = canvas.parentElement?.clientWidth ?? 600;
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(0.5, Math.min(3, width / base.width)) * (window.devicePixelRatio || 1);
    const vp = page.getViewport({ scale });
    canvas.width = vp.width; canvas.height = vp.height;
    canvas.style.width = '100%';
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp, canvas }).promise;
  }

  async function linkHere(l: Lesson) {
    await saveBookRef(db, l.id, kindRef(pos));
    await loadLinks();
    linkNote = `Đã gắn Bài ${l.order} với ${meta?.kind === 'pdf' ? 'trang' : 'phần'} ${pos}.`;
  }
  async function unlink(l: Lesson) { await clearBookRef(db, l.id); await loadLinks(); }
  const label = $derived(meta?.kind === 'pdf' ? 'Trang' : 'Phần');
</script>

<div class="stack">
  <div class="row">
    <button class="btn soft" type="button" onclick={onback}>‹ Quay lại</button>
    <strong class="grow">{meta?.name ?? book.title}</strong>
  </div>

  {#if loading}
    <p class="muted">Đang mở sách…</p>
  {:else if error}
    <div class="card" role="alert"><strong>Không mở được sách</strong><p class="muted">{error}</p></div>
  {:else}
    <div class="row bar">
      <button class="btn soft" type="button" onclick={() => go(pos - 1)} disabled={pos <= 1} aria-label={`${label} trước`}>‹</button>
      <form class="row" onsubmit={(e) => { e.preventDefault(); go(Number(jump)); }}>
        <label class="sr" for="jump">{label}</label>
        <input id="jump" inputmode="numeric" bind:value={jump} size="4" />
        <span>/ {total}</span>
      </form>
      <button class="btn soft" type="button" onclick={() => go(pos + 1)} disabled={pos >= total} aria-label={`${label} sau`}>›</button>
      {#if hereLesson}<button class="chip pink" type="button" onclick={() => onopenlesson(hereLesson)}>Đang ở Bài {hereLesson.order} · mở bài học</button>{/if}
    </div>

    <div class="layout">
      <div class="page card">
        {#if meta?.kind === 'pdf'}
          <canvas bind:this={canvas} aria-label={`${label} ${pos} của sách`}></canvas>
        {:else}
          <iframe title={`${label} ${pos}`} sandbox="" {srcdoc}></iframe>
        {/if}
      </div>

      <aside class="card stack">
        <strong>Gắn bài học với sách</strong>
        <p class="muted">Đứng ở {label.toLowerCase()} đầu của một bài, rồi bấm “Gắn”. Lần sau nút “Mở trang sách” trong bài sẽ nhảy thẳng tới đây.</p>
        {#if linkNote}<p role="status" class="ok">{linkNote}</p>{/if}
        <ul class="lessons">
          {#each lessons as l (l.id)}
            {@const at = links.find((k) => k.lessonId === l.id)?.at}
            <li>
              <button class="link" type="button" onclick={() => at && go(at)} disabled={!at}>Bài {l.order}{at ? ` · ${label.toLowerCase()} ${at}` : ''}</button>
              <button class="btn soft" type="button" onclick={() => linkHere(l)}>Gắn</button>
              {#if at}<button class="link" type="button" onclick={() => unlink(l)} aria-label={`Bỏ gắn bài ${l.order}`}>✕</button>{/if}
            </li>
          {:else}<li class="muted">Giáo trình này chưa có bài nào để gắn.</li>{/each}
        </ul>
      </aside>
    </div>
  {/if}
</div>

<style>
  .stack { display: grid; gap: var(--space-3); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .grow { flex: 1 1 10rem; overflow-wrap: anywhere; }
  .muted { color: var(--text-muted); margin: 0; }
  .ok { color: var(--success); font-weight: 700; margin: 0; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .bar input { width: 4.5rem; min-height: 44px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface); text-align: center; }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: minmax(0, 1fr); align-items: start; }
  @media (min-width: 820px) { .layout { grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr); } }
  .page { padding: var(--space-2); overflow: auto; background: #fff; }
  canvas { display: block; }
  iframe { width: 100%; height: 70vh; border: 0; background: #fff; }
  .lessons { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); max-height: 50vh; overflow: auto; }
  .lessons li { display: flex; gap: var(--space-2); align-items: center; }
  .lessons li > :first-child { flex: 1; text-align: left; }
  .link { background: none; border: 0; color: var(--accent-strong); min-height: 44px; }
  .link:disabled { color: var(--text-muted); }
  .chip { border: 0; min-height: 36px; }
</style>
