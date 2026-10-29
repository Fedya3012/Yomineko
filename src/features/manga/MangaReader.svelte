<script lang="ts">
  import type { DB } from '../../lib/db';
  import { assets } from './assets';
  import { openBook } from './open';
  import { filesFromDrop } from './sources/folder';
  import type { Book } from './types';
  import Viewer from './Viewer.svelte';

  let { db, onBack }: { db: DB; onBack: () => void } = $props();

  let book = $state<Book>();
  let busy = $state(false);
  let error = $state('');
  let dragging = $state(false);

  async function open(files: File[]) {
    busy = true; error = '';
    try { book = await openBook(files, assets()); }
    catch (e) { error = e instanceof Error ? e.message : String(e); }
    finally { busy = false; }
  }

  const fromInput = (e: Event & { currentTarget: HTMLInputElement }) => {
    const files = [...(e.currentTarget.files ?? [])];
    e.currentTarget.value = ''; // so picking the same thing again still fires
    if (files.length) void open(files);
  };

  async function onDrop(e: DragEvent) {
    e.preventDefault(); dragging = false;
    if (!e.dataTransfer) return;
    // Folders must be read while the event is live; plain files can be used directly.
    const files = e.dataTransfer.items?.length ? await filesFromDrop(e.dataTransfer.items) : [...e.dataTransfer.files];
    if (files.length) void open(files);
  }
</script>

{#if book}
  <Viewer {book} {db} onClose={() => (book = undefined)} />
{:else}
  <div class="manga-home">
    <button class="btn soft" onclick={onBack}>← Trang chủ</button>
    <h1>Đọc manga <span lang="ja">漫画</span></h1>
    <p class="muted">Yomineko không kèm sẵn truyện nào. Bạn tự nạp file truyện của mình; file nằm yên trên máy bạn, không bị tải đi đâu.</p>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <section class="card drop" class:dragging ondragover={(e) => { e.preventDefault(); dragging = true; }}
      ondragleave={() => (dragging = false)} ondrop={onDrop}>
      <p><strong>Kéo thả</strong> file hoặc thư mục truyện vào đây, hoặc chọn bên dưới:</p>
      <div class="row">
        <label class="btn">Chọn file (CBZ, CBR, PDF)
          <input type="file" accept=".cbz,.zip,.cbr,.rar,.cb7,.7z,.pdf,application/pdf,application/zip,application/vnd.comicbook+zip,application/vnd.comicbook-rar" onchange={fromInput} hidden />
        </label>
        <label class="btn soft">Chọn thư mục ảnh
          <input type="file" webkitdirectory multiple onchange={fromInput} hidden />
        </label>
        <label class="btn soft">Chọn nhiều ảnh
          <input type="file" accept="image/*" multiple onchange={fromInput} hidden />
        </label>
      </div>
      {#if busy}<p role="status">Đang mở truyện… (file lớn có thể mất vài giây)</p>{/if}
      {#if error}<p class="err" role="alert">{error}</p>{/if}
    </section>

    <section class="card">
      <h2>Mẹo</h2>
      <ul>
        <li>Chạm giữa trang để ẩn/hiện thanh công cụ; chạm hai mép để lật trang; chạm đúp để phóng to.</li>
        <li>Bật <strong>Đọc chữ (OCR)</strong>, rồi chạm vào chữ Nhật trên trang để xem nghĩa. OCR chạy hoàn toàn trên máy, không cần mạng.</li>
        <li>OCR cả trang đôi khi sai; dùng <strong>Chọn vùng chữ</strong> để quét riêng một khung thoại sẽ chính xác hơn.</li>
        <li>Trên Android, nếu không chọn được thư mục, hãy dùng “Chọn nhiều ảnh” hoặc nén thư mục thành CBZ.</li>
      </ul>
    </section>
  </div>
{/if}

<style>
  .manga-home { max-width: 1100px; width: 100%; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-4); }
  h1 { margin: 0; font-size: var(--text-xl); color: var(--accent-strong); }
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: 0; }
  .drop { border: 2px dashed var(--border); text-align: center; }
  .drop.dragging { border-color: var(--accent); background: var(--accent-soft); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); justify-content: center; }
  .err { color: var(--accent-strong); }
  ul { margin: 0; padding-left: 1.2rem; display: grid; gap: var(--space-2); }
</style>
