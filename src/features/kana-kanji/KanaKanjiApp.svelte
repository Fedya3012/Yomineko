<script lang="ts">
  // Màn hình chính của mô-đun "Kana & Kanji". Tự mở kho offline và cài các gói nội dung đi kèm nếu chưa có.
  import { onMount } from 'svelte';
  import { openDatabase, type DB } from '../../lib/db';
  import { ensureContentInstalled, loadKana, loadKanji } from './model';
  import type { Kana, Kanji } from './types';
  import KanaPanel from './KanaPanel.svelte';
  import KanjiPanel from './KanjiPanel.svelte';
  import DrillView from './DrillView.svelte';

  let { onback }: { onback?: () => void } = $props();

  type Tab = 'kana' | 'kanji' | 'drill';
  let tab = $state<Tab>('kana');
  let db = $state<DB>();
  let kana = $state<Kana[]>([]);
  let kanji = $state<Kanji[]>([]);
  let error = $state('');

  const TABS: [Tab, string][] = [['kana', 'Bảng chữ kana'], ['kanji', 'Kanji'], ['drill', 'Luyện tập']];

  onMount(async () => {
    try {
      const d = await openDatabase();
      await ensureContentInstalled(d);
      [kana, kanji] = await Promise.all([loadKana(d), loadKanji(d)]);
      db = d;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });
</script>

<div class="wrap">
  <header>
    {#if onback}<button class="btn soft" onclick={onback}>← Trang chủ</button>{/if}
    <h1>Kana & Kanji <span lang="ja">かな・漢字</span></h1>
  </header>
  <div class="row" role="tablist" aria-label="Mục học">
    {#each TABS as [id, label]}
      <button class="btn" class:soft={tab !== id} role="tab" aria-selected={tab === id} onclick={() => (tab = id)}>{label}</button>
    {/each}
  </div>
  {#if error}
    <p class="card" role="alert">Không mở được dữ liệu: {error}</p>
  {:else if !db}
    <p class="card" role="status">Đang chuẩn bị dữ liệu offline...</p>
  {:else if tab === 'kana'}
    <KanaPanel {db} {kana} />
  {:else if tab === 'kanji'}
    <KanjiPanel {db} {kanji} />
  {:else}
    <DrillView {db} {kana} />
  {/if}
</div>

<style>
  .wrap { display: grid; gap: var(--space-3); }
  header { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
  h1 { margin: 0; font-size: var(--text-xl); color: var(--accent-strong); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
</style>
