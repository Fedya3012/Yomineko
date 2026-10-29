<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { installPack } from '../../lib/packs/install';
  import samplePack from '../../../packs-example/dict-sample.pack.json';
  import { dict, loadDictionary } from './state.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import LookupText from './LookupText.svelte';
  import LicensesPanel from './LicensesPanel.svelte';

  let { db }: { db: DB } = $props();
  let status = $state('');

  onMount(() => loadDictionary(db));

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
{#if !dict.index}
  <p><button class="btn soft" onclick={addSample}>Cài từ điển mẫu (30 từ)</button></p>
  {#if status}<p role="status">{status}</p>{/if}
{/if}

<h3>Thử chạm vào từ</h3>
<LookupText text="猫は静かに本を読みました。" />
<LicensesPanel />

<style>
  .muted { color: var(--text-muted); }
  h3 { font-size: var(--text-md); margin: var(--space-4) 0 var(--space-1); }
</style>
