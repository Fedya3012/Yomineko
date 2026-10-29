<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { playAudio } from './audio';
  import { loadAudio, removeAudio, saveAudio } from './store';

  let { db, lessonId, audioKey, text, label = 'Nghe' }:
    { db: DB; lessonId: string; audioKey: string; text: string; label?: string } = $props();

  let hasFile = $state(false);
  let note = $state('');
  let picker: HTMLInputElement | undefined;

  onMount(async () => { hasFile = !!(await loadAudio(db, lessonId, audioKey)); });

  async function play() {
    note = '';
    try {
      const how = await playAudio(db, lessonId, audioKey, text);
      if (how === 'none') note = 'Máy này chưa có giọng đọc. Hãy gắn file âm thanh của bạn.';
    } catch { note = 'Không phát được file này.'; }
  }
  async function attach(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    await saveAudio(db, lessonId, audioKey, f);
    hasFile = true;
  }
  async function detach() { await removeAudio(db, lessonId, audioKey); hasFile = false; }
</script>

<span class="audio">
  <button class="play" type="button" onclick={play} aria-label={`${label}: ${text}`}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 9v6h4l5 4V5L9 9zM17 8c1.5 1.2 1.5 6.8 0 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
  <button class="mini" type="button" onclick={() => (hasFile ? detach() : picker?.click())}
    title={hasFile ? 'Bỏ file âm thanh đã gắn' : 'Gắn file âm thanh của bạn (từ sách bạn đã mua)'}>
    {hasFile ? 'Đã gắn file ✕' : 'Gắn file'}
  </button>
  <input bind:this={picker} type="file" accept="audio/*" hidden onchange={attach} />
  {#if note}<span class="note" role="status">{note}</span>{/if}
</span>

<style>
  .audio { display: inline-flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
  .play {
    width: 44px; height: 44px; border-radius: 50%; border: 0; display: grid; place-items: center;
    background: var(--info-soft); color: var(--info);
  }
  .mini { border: 1px dashed var(--border); background: transparent; color: var(--text-muted); border-radius: var(--radius-pill); padding: .2rem .7rem; min-height: 32px; font-size: var(--text-sm); }
  .note { color: var(--text-muted); font-size: var(--text-sm); }
</style>
