<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { ProviderConfig } from '../assistant/types';
  import { FIT_LABEL, MODELS, detectRamGb, fitFor, suggestFor, type Fit, type ModelInfo } from './catalog';
  import { deleteModel, isInstalled, listInstalled, pullModel } from './ollama';
  import { WEB_BASE_URL, deleteWebModel, hasShaderF16, isWebModelCached, loadWebModel, supportsWebGpu, webModelId } from './webllm';

  const OLLAMA_URL = 'http://localhost:11434/v1';

  let { provider, ramGb, onSelect, onRam }: {
    provider: ProviderConfig; ramGb?: number;
    onSelect: (p: ProviderConfig) => void; onRam: (gb: number | undefined) => void;
  } = $props();

  const webOk = supportsWebGpu();
  // Start on the tab matching the saved choice; after that the user switches tabs themselves.
  let engine = $state<'app' | 'ollama'>(untrack(() => (provider.kind === 'webllm' || (webOk && provider.kind !== 'openai-compatible') ? 'app' : 'ollama')));
  const ollamaUrl = $derived(provider.kind === 'openai-compatible' && /localhost|127\.0\.0\.1/.test(provider.baseUrl) ? provider.baseUrl : OLLAMA_URL);

  let installed = $state<string[]>([]);
  let reachable = $state<boolean | null>(null);
  let cached = $state<Record<string, boolean>>({});
  let f16 = $state(false);
  let progress = $state<Record<string, number>>({});
  let error = $state('');

  const detected = detectRamGb();
  const ram = $derived(ramGb ?? detected);
  const suggestion = $derived(suggestFor(ram));
  const tone: Record<Fit, string> = { ok: 'mint', heavy: 'butter', no: 'rose', unknown: 'sky' };
  const msg = (e: unknown) => (e instanceof Error ? e.message : 'lỗi không rõ');

  async function refresh() {
    if (engine === 'ollama') {
      try { installed = await listInstalled(ollamaUrl); reachable = true; } catch { installed = []; reachable = false; }
    } else {
      f16 = await hasShaderF16();
      const next: Record<string, boolean> = {};
      for (const m of MODELS) { const id = webModelId(m, f16); if (id) next[m.id] = await isWebModelCached(id); }
      cached = next;
    }
  }
  onMount(refresh);
  function setEngine(e: 'app' | 'ollama') { engine = e; error = ''; refresh(); }

  async function download(m: ModelInfo) {
    error = ''; progress[m.id] = 0;
    try {
      if (engine === 'ollama') {
        await pullModel(ollamaUrl, m.ollama, (p) => { if (p.total) progress[m.id] = Math.round((p.done / p.total) * 100); });
      } else {
        await loadWebModel(webModelId(m, f16)!, (f) => (progress[m.id] = Math.round(f * 100)));
      }
    } catch (e) { error = `Không tải được ${m.name}: ${msg(e)}`; }
    delete progress[m.id];
    await refresh();
  }

  async function remove(m: ModelInfo) {
    error = '';
    try { engine === 'ollama' ? await deleteModel(ollamaUrl, m.ollama) : await deleteWebModel(webModelId(m, f16)!); }
    catch (e) { error = `Không xoá được ${m.name}: ${msg(e)}`; }
    await refresh();
  }

  function use(m: ModelInfo) {
    if (engine === 'app') onSelect({ kind: 'webllm', baseUrl: WEB_BASE_URL, model: webModelId(m, f16)! });
    else onSelect({ kind: 'openai-compatible', baseUrl: ollamaUrl, model: m.ollama });
  }

  const tagOf = (m: ModelInfo) => (engine === 'app' ? webModelId(m, f16) : m.ollama);
  const available = (m: ModelInfo) => (engine === 'app' ? !!webModelId(m, f16) : true);
  const have = (m: ModelInfo) => (engine === 'app' ? cached[m.id] : isInstalled(installed, m.ollama));
</script>

<div class="picker">
  <div class="row" role="radiogroup" aria-label="Nơi chạy model">
    <button class="btn" class:soft={engine !== 'app'} role="radio" aria-checked={engine === 'app'} onclick={() => setEngine('app')}>Chạy trong app</button>
    <button class="btn" class:soft={engine !== 'ollama'} role="radio" aria-checked={engine === 'ollama'} onclick={() => setEngine('ollama')}>Qua Ollama</button>
  </div>
  <p class="muted">
    {#if engine === 'app'}Model tải một lần rồi chạy offline ngay trong app bằng card đồ hoạ (WebGPU), không cần cài gì thêm.
    {:else}Model chạy bằng Ollama cài trên máy bạn (ollama.com). Hợp với Windows và máy tính mạnh.{/if}
    Xếp từ nhẹ/yếu đến nặng/mạnh.
  </p>
  {#if engine === 'app' && !webOk}<p class="warn" role="status">Trình duyệt này chưa hỗ trợ WebGPU nên chưa chạy model trong app được. Hãy dùng Chrome hoặc Edge mới, hoặc chọn "Qua Ollama".</p>{/if}
  <label>RAM của máy (GB)
    <input type="number" min="1" max="128" step="1" value={ram ?? ''} placeholder="Chưa rõ, hãy nhập"
      onchange={(e) => { const v = e.currentTarget.valueAsNumber; onRam(Number.isFinite(v) && v > 0 ? v : undefined); }} />
  </label>
  {#if detected === 8 && ramGb === undefined}<p class="muted">Trình duyệt chỉ báo tối đa 8 GB. Nếu máy bạn nhiều RAM hơn, hãy nhập số thật.</p>{/if}
  {#if suggestion}<p class="muted">Gợi ý cho máy bạn: <strong>{suggestion.name}</strong></p>{/if}
  {#if engine === 'ollama' && reachable === false}
    <p class="warn" role="status">Chưa kết nối được Ollama tại {ollamaUrl}. Cài và bật Ollama để tải và dùng model; bạn vẫn xem được danh sách.</p>
  {/if}
  {#if error}<p class="warn" role="alert">{error}</p>{/if}

  <ul>
    {#each MODELS as m (m.id)}
      {@const fit = fitFor(m, ram)}
      {@const active = engine === 'app' ? provider.kind === 'webllm' && provider.model === tagOf(m) : provider.kind !== 'webllm' && provider.model === m.ollama}
      <li class:active>
        <div class="top">
          <strong>{m.name}</strong>
          {#if m.isDefault}<span class="chip sky">Mặc định</span>{/if}
          <span class="chip {tone[fit]}">{FIT_LABEL[fit]}</span>
        </div>
        <div class="muted">{m.sizeGb} GB tải về · cần khoảng {m.ramGb} GB RAM · {m.license}</div>
        <div class="muted">Tiếng Nhật: {m.japanese}</div>
        {#if m.licenseNote}<div class="muted">{m.licenseNote}</div>{/if}
        {#if engine === 'app' && m.web?.note}<div class="muted">{m.web.note}</div>{/if}
        <div class="row">
          {#if !available(m)}
            <span class="muted">Chưa có bản chạy trong app, hãy dùng "Qua Ollama".</span>
          {:else if m.id in progress}
            <progress max="100" value={progress[m.id]} aria-label="Đang tải {m.name}"></progress> {progress[m.id]}%
          {:else if have(m)}
            <button class="btn" disabled={active} onclick={() => use(m)}>{active ? 'Đang dùng' : 'Dùng model này'}</button>
            <button class="btn soft" onclick={() => remove(m)}>Xoá khỏi máy</button>
          {:else}
            <button class="btn" disabled={fit === 'no' || (engine === 'ollama' ? reachable === false : !webOk)} onclick={() => download(m)}>Tải về ({m.sizeGb} GB)</button>
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
