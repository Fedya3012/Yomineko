<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { installPack } from '../../lib/packs/install';
  import samplePack from '../../../packs-src/dict-sample/v1.json';
  import { dict, loadDictionary } from './state.svelte';
  import { downloadDictionary, hasRealDictionary, planDictionaryDownload } from './download';
  import SearchPanel from './SearchPanel.svelte';
  import LookupText from './LookupText.svelte';
  import LicensesPanel from './LicensesPanel.svelte';
  import JitendexCard from './JitendexCard.svelte';

  let { db }: { db: DB } = $props();
  let status = $state('');
  let busy = $state(false);
  let real = $state(false);
  let sizeText = $state('');

  onMount(async () => {
    await loadDictionary(db);
    real = await hasRealDictionary(db);
    if (!real) {
      try {
        const { bytes } = await planDictionaryDownload(db);
        if (bytes) sizeText = ` (${(bytes / 1048576).toFixed(1)} MB)`;
      } catch { /* offline or no dictionary in the feed: the sample button still works */ }
    }
  });

  async function download() {
    busy = true; status = 'Đang kiểm tra…';
    try {
      const { results } = await downloadDictionary(db, (t) => (status = t));
      const bad = results.filter((r) => !r.ok);
      status = !results.length ? 'Chưa có gói từ điển để tải. Thử lại sau nhé.'
        : bad.length ? `Chưa tải được: ${bad.map((r) => `${r.id} (${r.error})`).join('; ')}` : 'Đã tải xong từ điển đầy đủ ✔';
    } catch {
      status = 'Chưa tải được (có thể máy đang offline). Bạn có thể dùng từ điển mẫu hoặc thử lại sau.';
    }
    await loadDictionary(db);
    real = await hasRealDictionary(db);
    busy = false;
  }

  async function addSample() {
    try { await installPack(db, samplePack); status = 'Đã cài từ điển mẫu ✔'; }
    catch (e) { status = e instanceof Error ? e.message : String(e); }
    await loadDictionary(db);
  }
</script>

<h2>Từ điển</h2>
<p class="muted">
  Tra offline bằng chữ Hán, kana, romaji hoặc tiếng Anh. Chạm vào kết quả để xem đầy đủ.
  {#if dict.index}Đang có {dict.count} từ.{/if}
</p>
<SearchPanel {db} />
{#if !real}
  <p>
    <button class="btn" onclick={download} disabled={busy}>Tải từ điển đầy đủ{sizeText}</button>
    {#if !dict.index}<button class="btn soft" onclick={addSample} disabled={busy}>Dùng từ điển mẫu (30 từ)</button>{/if}
  </p>
{/if}
{#if status}<p role="status">{status}</p>{/if}

<h3>Thử chạm vào từ</h3>
<LookupText text="猫は静かに本を読みました。" />
<JitendexCard {db} />
<LicensesPanel />

<style>
  .muted { color: var(--text-muted); }
  h3 { font-size: var(--text-md); margin: var(--space-4) 0 var(--space-1); }
</style>
