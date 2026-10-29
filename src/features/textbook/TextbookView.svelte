<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { installPack } from '../../lib/packs/install';
  import { validatePack } from '../../lib/packs/format';
  import LessonView from './LessonView.svelte';
  import { bookRatio, isEmptyLesson, lessonRatio, nextLesson } from './logic';
  import { loadAllProgress, loadLessons, loadTextbooks } from './store';
  import { BUNDLED_PACKS, ensureBundledPacks, TEMPLATE_PACK } from './bundled';
  import { emptyProgress, type Lesson, type LessonProgress, type Textbook } from './types';

  let { db, onback }: { db: DB; onback: () => void } = $props();

  let books = $state.raw<Textbook[]>([]);
  let lessons = $state.raw<Lesson[]>([]);
  let progress = $state.raw<Map<string, LessonProgress>>(new Map());
  let bookId = $state<string>();
  let lessonId = $state<string>();
  let message = $state('');
  let failed = $state(false);
  let picker = $state<HTMLInputElement>();

  const colors = ['pink', 'sky', 'mint', 'butter'] as const;
  const book = $derived(books.find((b) => b.id === bookId));
  const bookLessons = $derived(lessons.filter((l) => l.textbookId === bookId));
  const lesson = $derived(lessons.find((l) => l.id === lessonId));
  const idx = $derived(bookLessons.findIndex((l) => l.id === lessonId));
  const get = (id: string) => progress.get(id) ?? emptyProgress();

  async function reload() {
    [books, lessons] = await Promise.all([loadTextbooks(db), loadLessons(db)]);
    books = [...books].sort((a, b) => a.title.localeCompare(b.title));
    progress = await loadAllProgress(db, lessons);
  }
  async function reloadProgress() { progress = await loadAllProgress(db, lessons); }

  onMount(async () => {
    try { await ensureBundledPacks(db); await reload(); }
    catch (e) { failed = true; message = e instanceof Error ? e.message : String(e); }
  });

  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const pack = validatePack(JSON.parse(await f.text()));
      await installPack(db, pack);
      await reload();
      failed = false;
      message = `Đã nạp “${pack.manifest.title}” ✔`;
    } catch (err) {
      failed = true;
      message = `Không nạp được file: ${err instanceof Error ? err.message : String(err)}`;
    }
    input.value = '';
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(TEMPLATE_PACK, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'giao-trinh-cua-toi.pack.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function openBook(id: string) { bookId = id; lessonId = undefined; }
  function openLesson(l: Lesson) { bookId = l.textbookId; lessonId = l.id; }
  const stats = (b: Textbook) => {
    const ls = lessons.filter((l) => l.textbookId === b.id);
    return { ls, ratio: bookRatio(ls, progress), filled: ls.filter((l) => !isEmptyLesson(l)).length, next: nextLesson(ls, progress) };
  };
</script>

<div class="stack">
  {#if lesson}
    <LessonView {db} {lesson} prev={bookLessons[idx - 1]} next={bookLessons[idx + 1]}
      onback={() => (lessonId = undefined)} onopen={openLesson} onprogress={reloadProgress} />
  {:else if book}
    {@const s = stats(book)}
    <button class="btn soft back" type="button" onclick={() => (bookId = undefined)}>‹ Tủ sách</button>
    <header>
      {#if book.titleJa}<span class="chip pink" lang="ja">{book.titleJa}</span>{/if}
      <h2>{book.title}</h2>
      <p class="muted">{book.level ?? ''} · {s.ls.length} bài · {s.filled} bài đã có nội dung · hoàn thành {Math.round(s.ratio * 100)}%</p>
      <progress max="1" value={s.ratio} aria-label={`Tiến độ ${book.title}`}></progress>
      {#if s.next}<p><button class="btn" type="button" onclick={() => openLesson(s.next!)}>Học tiếp: Bài {s.next.order}</button></p>{/if}
    </header>
    <section class="card" aria-label="Mục lục">
      <h3><span lang="ja">目次</span> · Mục lục</h3>
      {#each s.ls as l (l.id)}
        {@const r = lessonRatio(l, get(l.id))}
        <div class="unit" class:done={r >= 1} class:now={s.next?.id === l.id}>
          <span class="st" aria-hidden="true">{r >= 1 ? '✓' : String(l.order).padStart(3, '0')}</span>
          <div class="grow">
            <strong>Bài {l.order} · {l.title}</strong>
            <progress max="1" value={r} aria-label={`Tiến độ bài ${l.order}`}></progress>
            <span class="muted">{isEmptyLesson(l) ? 'Chưa có nội dung (nạp file của bạn)' : r >= 1 ? 'Đã xong' : r > 0 ? `${Math.round(r * 100)}% · đang học` : 'Chưa học'}</span>
          </div>
          <button class="btn" class:soft={s.next?.id !== l.id} type="button" onclick={() => openLesson(l)}>{r >= 1 ? 'Ôn lại' : r > 0 ? 'Học tiếp' : isEmptyLesson(l) ? 'Xem' : 'Bắt đầu'}</button>
        </div>
      {/each}
    </section>
  {:else}
    <button class="btn soft back" type="button" onclick={onback}>‹ Trang chính</button>
    <header>
      <span class="chip pink" lang="ja">教科書</span>
      <h2>Học theo giáo trình</h2>
      <p class="muted">Chọn một giáo trình, rồi học lần lượt từng bài: hướng dẫn, từ vựng, ngữ pháp, hội thoại, bài tập.</p>
    </header>

    <div class="card note" role="note">
      <strong>Vì sao phải tự nạp?</strong>
      <p class="muted">Minna no Nihongo, Genki… có bản quyền nên app không kèm sẵn nội dung hay âm thanh của sách. App có sẵn khung bài (số bài, mục lục) và một giáo trình mẫu tự viết. Bạn tự nạp từ vựng, ngữ pháp, âm thanh từ sách của mình, hoặc nạp gói do cộng đồng chia sẻ hợp pháp.</p>
    </div>

    <div class="row">
      <button class="btn" type="button" onclick={() => picker?.click()}>＋ Thêm giáo trình (nạp file)</button>
      <button class="btn soft" type="button" onclick={downloadTemplate}>Tải file mẫu để điền</button>
      <input bind:this={picker} type="file" accept=".json,application/json" hidden onchange={importFile} />
    </div>
    {#if message}<p role="status" class:bad={failed}>{message}</p>{/if}

    {#if books.length}
      <div class="shelf">
        {#each books as b, i (b.id)}
          {@const s = stats(b)}
          <article class="card book">
            <div class="cover {colors[i % colors.length]}" role="img" aria-label={`Bìa ${b.title}`}>
              <span class="jp" lang="ja">{b.titleJa ?? b.title}</span>
            </div>
            <strong>{b.title}</strong>
            <span class="muted">{s.ls.length} bài{b.level ? ` · ${b.level}` : ''}</span>
            <progress max="1" value={s.ratio} aria-label={`Tiến độ ${b.title}`}></progress>
            <button class="btn" type="button" onclick={() => openBook(b.id)}>{s.ratio > 0 ? 'Học tiếp' : 'Mở sách'}</button>
          </article>
        {/each}
      </div>
    {:else if !failed}
      <p class="muted">Đang tải giáo trình…</p>
    {/if}
    <p class="muted">Có sẵn: {BUNDLED_PACKS.map((p) => p.manifest.title).join(' · ')}</p>
  {/if}
</div>

<style>
  .stack { display: grid; gap: var(--space-3); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .back { justify-self: start; }
  h2 { margin: var(--space-1) 0; font-size: var(--text-xl); color: var(--accent-strong); }
  h3 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: 0; }
  .bad { color: var(--accent-strong); font-weight: 700; }
  .note { background: var(--info-soft); border-color: transparent; }
  progress { width: 100%; height: 10px; accent-color: var(--accent); }
  .shelf { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3); }
  .shelf > * { min-width: 0; }
  .book { display: grid; gap: var(--space-2); align-content: start; background: var(--surface-2); }
  .cover { aspect-ratio: 3 / 4; border-radius: var(--radius-sm); display: flex; justify-content: center; padding: var(--space-2); box-shadow: var(--shadow); overflow: hidden; }
  .cover span { writing-mode: vertical-rl; max-height: 100%; font-size: var(--text-md); line-height: 1.6; font-weight: 700; color: var(--ink); }
  .cover.pink { background: var(--sakura-100); } .cover.sky { background: var(--sky-100); }
  .cover.mint { background: var(--mint-100); } .cover.butter { background: var(--butter-100); }
  :root[data-theme='dark'] .cover.pink { background: var(--accent-soft); }
  :root[data-theme='dark'] .cover.sky { background: #263a4f; }
  :root[data-theme='dark'] .cover.mint { background: var(--success-soft); }
  :root[data-theme='dark'] .cover.butter { background: #4a4126; }
  .unit { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px dashed var(--border); flex-wrap: wrap; }
  .unit.now { background: var(--surface-2); border-radius: var(--radius-sm); padding-inline: var(--space-2); }
  .st { width: 3rem; text-align: center; font-weight: 800; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .unit.done .st { color: var(--success); }
  .grow { flex: 1 1 10rem; display: grid; gap: 2px; }
</style>
