<script lang="ts">
  import { onMount } from 'svelte';
  import { FIT_LABEL, MODELS, detectRamGb, fitFor, suggestFor, type Fit, type ModelInfo } from './catalog';
  import { deleteModel, isInstalled, listInstalled, pullModel } from './ollama';

  let { baseUrl, current, ramGb, onSelect, onRam }: {
    baseUrl: string; current: string; ramGb?: number;
    onSelect: (m: ModelInfo) => void; onRam: (gb: number | undefined) => void;
  } = $props();

  let installed = $state<string[]>([]);
  let reachable = $state<boolean | null>(null);
  let progress = $state<Record<string, number>>({});
  let error = $state('');

  const detected = detectRamGb();
  const ram = $derived(ramGb ?? detected);
  const suggestion = $derived(suggestFor(ram));
  const tone: Record<Fit, string> = { ok: 'mint', heavy: 'butter', no: 'rose', unknown: 'sky' };

  async function refresh() {
    try { installed = await listInstalled(baseUrl); reachable = true; } catch { installed = []; reachable = false; }
  }
  onMount(refresh);

  async function download(m: ModelInfo) {
    error = ''; progress[m.id] = 0;
    try {
      await pullModel(baseUrl, m.ollama, (p) => { if (p.total) progress[m.id] = Math.round((p.done / p.total) * 100); });
    } catch (e) {
      error = `Không tải được ${m.name}: ${e instanceof Error ? e.message : 'lỗi không rõ'}`;
    }
    delete progress[m.id];
    await refresh();
  }

  async function remove(m: ModelInfo) {
    error = '';
    try { await deleteModel(baseUrl, m.ollama); } catch (e) { error = `Không xoá được ${m.name}: ${e instanceof Error ? e.message : 'lỗi không rõ'}`; }
    await refresh();
  }
</script>

<div class="picker">
  <p class="muted">Danh sách model AI chạy ngay trên máy bạn qua Ollama, xếp từ nhẹ/yếu đến nặng/mạnh. Chọn model hợp với RAM máy.</p>
  <label>RAM của máy (GB)
    <input type="number" min="1" max="128" step="1" value={ram ?? ''} placeholder="Chưa rõ, hãy nhập"
      onchange={(e) => { const v = e.currentTarget.valueAsNumber; onRam(Number.isFinite(v) && v > 0 ? v : undefined); }} />
  </label>
  {#if detected === 8 && ramGb === undefined}<p class="muted">Trình duyệt chỉ báo tối đa 8 GB. Nếu máy bạn nhiều RAM hơn, hãy nhập số thật.</p>{/if}
  {#if suggestion}<p class="muted">Gợi ý cho máy bạn: <strong>{suggestion.name}</strong></p>{/if}
  {#if reachable === false}
    <p class="warn" role="status">Chưa kết nối được Ollama tại {baseUrl}. Cài và bật Ollama (ollama.com) để tải và dùng model; bạn vẫn xem được danh sách.</p>
  {/if}
  {#if error}<p class="warn" role="alert">{error}</p>{/if}

  <ul>
    {#each MODELS as m (m.id)}
      {@const fit = fitFor(m, ram)}
      {@const have = isInstalled(installed, m.ollama)}
      {@const active = current === m.ollama}
      <li class:active>
        <div class="top">
          <strong>{m.name}</strong>
          {#if m.isDefault}<span class="chip sky">Mặc định</span>{/if}
          <span class="chip {tone[fit]}">{FIT_LABEL[fit]}</span>
        </div>
        <div class="muted">{m.sizeGb} GB tải về · cần khoảng {m.ramGb} GB RAM · {m.license}</div>
        <div class="muted">Tiếng Nhật: {m.japanese}</div>
        {#if m.licenseNote}<div class="muted">{m.licenseNote}</div>{/if}
        <div class="row">
          {#if m.id in progress}
            <progress max="100" value={progress[m.id]} aria-label="Đang tải {m.name}"></progress> {progress[m.id]}%
          {:else if have}
            <button class="btn" disabled={active} onclick={() => onSelect(m)}>{active ? 'Đang dùng' : 'Dùng model này'}</button>
            <button class="btn soft" onclick={() => remove(m)}>Xoá khỏi máy</button>
          {:else}
            <button class="btn" disabled={reachable === false || fit === 'no'} onclick={() => download(m)}>Tải về ({m.sizeGb} GB)</button>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  .picker { display: grid; gap: var(--space-2); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  li { display: grid; gap: 4px; padding: var(--space-3); border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
  li.active { border-color: var(--accent); background: var(--accent-soft); }
  .top, .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); }
  .muted { color: var(--text-muted); margin: 0; font-size: var(--text-sm); }
  .warn { margin: 0; padding: var(--space-2) var(--space-3); border-radius: 12px; background: var(--butter-100); color: var(--text); }
  label { display: grid; gap: 4px; }
  input { width: 100%; min-height: 44px; padding: 0 var(--space-3); border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
  progress { flex: 1; min-width: 8rem; }
</style>
