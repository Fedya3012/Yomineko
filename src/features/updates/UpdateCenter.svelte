<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';
  import type { DB } from '../../lib/db';
  import { APP_REPO, APP_VERSION, CATALOG_URL, detectPlatform } from '../../lib/appInfo';
  import { checkAppUpdate, type AppUpdate } from '../../lib/appUpdate';
  import { applyUpdates, checkContentUpdates } from '../../lib/packs/updater';
  import type { UpdatePlan } from '../../lib/packs/install';
  import type { InstalledPack } from '../../lib/db';

  let { db, onContentChanged = () => {} }: { db: DB; onContentChanged?: () => void } = $props();

  const platform = detectPlatform();
  const CHECK_EVERY_MS = 12 * 3600 * 1000;
  const LAST_CHECK = 'yomineko.updates.lastCheck';

  let busy = $state<'' | 'checking' | 'installing'>('');
  let message = $state('');
  let failed = $state(false);
  let appUpdate = $state<AppUpdate | undefined>();
  let webUpdateReady = $state(false);
  let plans = $state<UpdatePlan[]>([]);
  let blocked = $state<UpdatePlan[]>([]);
  let installed = $state<InstalledPack[]>([]);
  let progress = $state('');

  let reloadWeb: ((reload?: boolean) => Promise<void>) | undefined;

  const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`);
  const total = $derived(plans.reduce((n, p) => n + p.bytes, 0));
  const hasNews = $derived(!!appUpdate || webUpdateReady || plans.length > 0);

  async function loadInstalled() { installed = (await db.getAll('packs')).sort((a, b) => a.title.localeCompare(b.title)); }

  async function check(manual: boolean) {
    busy = 'checking'; failed = false; message = '';
    try {
      if (manual) await loadInstalled();
      const [app, content] = await Promise.allSettled([
        platform === 'web' ? Promise.resolve(undefined) : checkAppUpdate(APP_VERSION, APP_REPO, platform),
        checkContentUpdates(db, CATALOG_URL, APP_VERSION)
      ]);
      if (app.status === 'fulfilled' && app.value?.status === 'available') appUpdate = app.value.update;
      if (content.status === 'fulfilled') {
        plans = content.value.filter((p) => p.steps.length > 0);
        blocked = content.value.filter((p) => p.needsNewerApp);
        try { localStorage.setItem(LAST_CHECK, String(Date.now())); } catch { /* private mode: just check again next time */ }
      } else if (manual) {
        failed = true;
        message = 'Chưa kiểm tra được (có thể máy đang offline). Bạn vẫn học bình thường, lát nữa thử lại nhé.';
      }
      if (manual && !failed && !hasNews) message = 'Mọi thứ đã mới nhất ✔';
    } finally {
      busy = '';
    }
  }

  async function install() {
    busy = 'installing'; failed = false; message = '';
    try {
      const results = await applyUpdates(db, plans, CATALOG_URL, {
        appVersion: APP_VERSION,
        onProgress: (done, count, plan) => (progress = `Đang cập nhật ${plan.id} (${Math.min(done + 1, count)}/${count})…`)
      });
      const bad = results.filter((r) => !r.ok);
      failed = bad.length > 0;
      message = bad.length
        ? `Có ${bad.length} gói chưa cập nhật được: ${bad.map((r) => `${r.id} (${r.error})`).join('; ')}. Dữ liệu cũ và tiến độ của bạn vẫn nguyên vẹn.`
        : 'Đã cập nhật xong. Tiến độ học của bạn được giữ nguyên ✔';
      await loadInstalled();
      onContentChanged();
      plans = plans.filter((p) => bad.some((r) => r.id === p.id));
    } finally {
      busy = ''; progress = '';
    }
  }

  async function openLink(url: string) {
    if (platform === 'windows') {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  onMount(() => {
    void loadInstalled();
    if (platform === 'web') {
      reloadWeb = registerSW({ onNeedRefresh: () => (webUpdateReady = true) });
    }
    let last = 0;
    try { last = Number(localStorage.getItem(LAST_CHECK)) || 0; } catch { /* ignore */ }
    if (navigator.onLine && Date.now() - last > CHECK_EVERY_MS) void check(false);
  });
</script>

<section class="card updates" class:has-news={hasNews} aria-labelledby="upd-title">
  <h2 id="upd-title">
    Cập nhật
    {#if hasNews}<span class="chip pink">Có bản mới</span>{/if}
  </h2>
  <p class="muted">Bản app: <strong>{APP_VERSION}</strong>. Nội dung học được cập nhật riêng, chỉ tải phần thay đổi.</p>

  {#if appUpdate}
    <div class="notice" role="status">
      <strong>Có bản app mới: {appUpdate.version}</strong>
      {#if platform === 'android'}
        <p>Nếu bạn dùng Obtainium, nó sẽ báo cập nhật cho bạn. Hoặc tải trực tiếp bên dưới.</p>
      {/if}
      <button class="btn" onclick={() => openLink(appUpdate!.downloadUrl ?? appUpdate!.releaseUrl)}>
        {platform === 'android' ? 'Tải bản Android mới' : 'Tải bản Windows mới'}
      </button>
      <button class="btn soft" onclick={() => openLink(appUpdate!.releaseUrl)}>Xem có gì mới</button>
    </div>
  {/if}

  {#if webUpdateReady}
    <div class="notice" role="status">
      <strong>Có bản web mới.</strong> Bấm để tải lại trang (tiến độ học được lưu sẵn, không mất).
      <button class="btn" onclick={() => reloadWeb?.(true)}>Tải lại để dùng bản mới</button>
    </div>
  {/if}

  {#if plans.length}
    <div class="notice" role="status">
      <strong>Có {plans.length} gói nội dung mới</strong> · cần tải khoảng {kb(total)}
      <ul>
        {#each plans as p (p.id)}
          <li>{p.id}: {p.from ? `bản ${p.from} → ${p.to}` : `cài mới (bản ${p.to})`} · {kb(p.bytes)}{p.steps.length > 1 ? ` (${p.steps.length} phần nhỏ)` : ''}</li>
        {/each}
      </ul>
      <button class="btn" disabled={busy !== ''} onclick={install}>{busy === 'installing' ? 'Đang cập nhật…' : 'Cập nhật nội dung'}</button>
    </div>
  {/if}

  {#each blocked as p (p.id)}
    <p class="notice" role="status">Gói {p.id} bản {p.to} cần app từ phiên bản {p.needsNewerApp}. Hãy cập nhật app trước.</p>
  {/each}

  {#if progress}<p role="status">{progress}</p>{/if}
  {#if message}<p role={failed ? 'alert' : 'status'} class:error={failed}>{message}</p>{/if}

  <button class="btn soft" disabled={busy !== ''} onclick={() => check(true)}>
    {busy === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra cập nhật'}
  </button>

  {#if installed.length}
    <details>
      <summary>Gói nội dung đã cài ({installed.length}) và giấy phép</summary>
      <ul>
        {#each installed as p (p.id)}
          <li>
            <strong>{p.title}</strong> · bản {p.version}<br />
            <span class="muted">Giấy phép: <a href={p.license.url} target="_blank" rel="noopener">{p.license.name}</a>{p.license.attribution ? ` · ${p.license.attribution}` : ''}</span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</section>

<style>
  .updates { display: grid; gap: var(--space-3); }
  .updates.has-news { border: 2px solid var(--accent); background: var(--surface-2); }
  h2 { margin: 0; font-size: var(--text-lg); display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
  p { margin: 0; }
  .notice { display: grid; gap: var(--space-2); justify-items: start; padding: var(--space-3); border-radius: var(--radius); background: var(--surface); }
  .notice ul, details ul { margin: 0; padding-left: 1.2rem; }
  .error { color: var(--accent-strong); }
  .btn:disabled { opacity: .6; cursor: progress; }
  summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  li + li { margin-top: var(--space-2); }
</style>
