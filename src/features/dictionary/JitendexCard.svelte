<script lang="ts">
  import type { DB } from '../../lib/db';
  import { dict, loadDictionary } from './state.svelte';
  import { checkJitendex, installJitendex, removeJitendex, type JitendexStatus } from './jitendexPack';

  let { db }: { db: DB } = $props();
  let status = $state<JitendexStatus>();
  let busy = $state<'' | 'checking' | 'installing'>('');
  let message = $state('');
  let failed = $state(false);

  const mb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1048576))} MB`;

  async function check() {
    busy = 'checking'; failed = false; message = '';
    try {
      status = await checkJitendex(db);
      if (!status.available) { failed = true; message = 'Chưa có gói Jitendex để tải.'; }
      else if (!status.plan) message = 'Jitendex đã mới nhất ✔';
    } catch {
      failed = true;
      message = 'Chưa kiểm tra được (có thể máy đang offline). Thử lại sau nhé.';
    } finally { busy = ''; }
  }
  async function install() {
    if (!status?.plan) return;
    busy = 'installing'; failed = false; message = 'Đang tải và cài Jitendex, vui lòng chờ…';
    try {
      await installJitendex(db, status.plan);
      await loadDictionary(db);
      status = { ...status, installed: status.available, plan: undefined };
      message = 'Đã cài Jitendex ✔ Mở một từ để chọn nguồn nghĩa.';
    } catch (e) {
      failed = true;
      message = `Chưa cài được: ${e instanceof Error ? e.message : String(e)}. Dữ liệu cũ và tiến độ học vẫn nguyên.`;
    } finally { busy = ''; }
  }
  async function remove() {
    await removeJitendex(db);
    await loadDictionary(db);
    status = undefined; failed = false; message = 'Đã gỡ Jitendex. Từ điển JMdict vẫn dùng bình thường.';
  }
</script>

<section class="card" aria-label="Từ điển Jitendex">
  <h3>Từ điển Jitendex (tuỳ chọn)</h3>
  <p class="muted">
    Nghĩa tiếng Anh chia theo loại từ, có ghi chú cách dùng và câu ví dụ cho từng nghĩa. Hiện cạnh JMdict trong cửa sổ tra từ;
    bạn chọn xem JMdict, Jitendex hay cả hai. Tải một lần rồi dùng offline.
  </p>
  <div class="row">
    {#if dict.hasJitendex}
      <span class="chip mint">✓ Đã cài</span>
      <button class="btn soft" onclick={check} disabled={!!busy}>Kiểm tra bản mới</button>
      <button class="btn soft" onclick={remove} disabled={!!busy}>Gỡ</button>
    {:else}
      <button class="btn" onclick={check} disabled={!!busy}>{busy === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra gói Jitendex'}</button>
    {/if}
    {#if status?.plan}
      <button class="btn" onclick={install} disabled={!!busy}>
        {busy === 'installing' ? 'Đang cài…' : `${dict.hasJitendex ? 'Cập nhật' : 'Cài'} (${mb(status.plan.bytes)})`}
      </button>
    {/if}
  </div>
  {#if message}<p role={failed ? 'alert' : 'status'} class:error={failed}>{message}</p>{/if}
</section>

<style>
  .muted { color: var(--text-muted); }
  h3 { font-size: var(--text-md); margin: 0 0 var(--space-1); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .error { color: var(--accent-strong); }
  section { margin-top: var(--space-4); }
</style>
