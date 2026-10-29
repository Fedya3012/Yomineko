<script lang="ts">
  import { onMount } from 'svelte';
  import { applySettings, loadSettings, saveSettings, type Settings, type ThemeChoice } from './lib/settings';
  import { openDatabase, listCollection, type DB } from './lib/db';
  import { installPack } from './lib/packs/install';
  import Badge from './lib/Badge.svelte';
  import Assistant from './features/assistant/Assistant.svelte';
  let dbReady = $state(false);
  import demoPack from '../packs-example/demo-hiragana.pack.json';

  let settings = $state<Settings>(loadSettings());
  let db = $state.raw<DB>();
  let words = $state<{ id: string; kanji: string; reading: string; meaning: string }[]>([]);
  let status = $state('');

  // Feature areas. Each later thread replaces its placeholder card with a real screen.
  const features = [
    { tone: 'coral', name: 'Ôn tập SRS', note: 'Thread SRS', d: 'M20 30h60v40H20zM30 20h40M35 45h30M35 58h18' },
    { tone: 'teal', name: 'Từ điển', note: 'Thread Từ điển', d: 'M50 28C40 20 25 20 15 26v50c10-6 25-6 35 2 10-8 25-8 35-2V26C75 20 60 20 50 28zM50 28v50' },
    { tone: 'mint', name: 'Kana & Kanji', note: 'Thread Kana/Kanji', d: 'M25 35h50M50 20v60M32 55c10 4 22 4 32 0M40 70c6 6 14 6 20 0' },
    { tone: 'sky', name: 'Đọc manga', note: 'Thread Manga', d: 'M20 20h60v60H20zM20 50h60M50 20v30M50 50v30' },
    { tone: 'coral', name: 'Xem anime', note: 'Thread Anime', d: 'M20 28h60v44H20zM42 40l20 10-20 10z' },
    { tone: 'mint', name: 'Tiến độ', note: 'Thread Tiến độ', d: 'M18 78V22M18 78h64M28 62l16-16 12 10 22-26' }
  ] as const;

  $effect(() => { applySettings(settings); saveSettings(settings); });

  async function refresh() {
    words = (await listCollection(db!, 'words')) as typeof words;
  }

  onMount(async () => {
    db = await openDatabase();
    dbReady = true;
    await refresh();
  });

  async function loadDemo() {
    try {
      await installPack(db!, demoPack);
      status = 'Đã cài gói mẫu ✔';
    } catch (e) {
      status = e instanceof Error ? e.message : String(e);
    }
    await refresh();
  }

  const themes: [ThemeChoice, string][] = [['system', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']];
</script>

<main>
  <header>
    <img src="favicon.svg" alt="Mochi, chú mèo trắng" width="56" height="56" />
    <div>
      <h1>Yomineko <span lang="ja">読み猫</span></h1>
      <p class="muted">Học tiếng Nhật qua manga và anime cùng Mochi</p>
    </div>
  </header>

  <section class="grid" aria-label="Tính năng">
    {#each features as f}
      <div class="card feature">
        <Badge tone={f.tone} size={64}><svg viewBox="0 0 100 100"><path d={f.d} /></svg></Badge>
        <strong>{f.name}</strong>
        <span class="chip">Sắp có · {f.note}</span>
      </div>
    {/each}
  </section>

  {#if dbReady}<Assistant db={db!} />{/if}

  <section class="card">
    <h2>Xem thử chữ Nhật</h2>
    <p class="jp sample" lang="ja">
      <ruby>猫<rt>ねこ</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かに<ruby>本<rt>ほん</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む。
    </p>
    <p class="jp sample vertical" lang="ja" style="height: 12rem">
      <ruby>猫<rt>ねこ</rt></ruby>は<ruby>静<rt>しず</rt></ruby>かに<ruby>本<rt>ほん</rt></ruby>を<ruby>読<rt>よ</rt></ruby>む。
    </p>
  </section>

  <section class="card">
    <h2>Cài đặt hiển thị</h2>
    <div class="row" role="radiogroup" aria-label="Giao diện">
      {#each themes as [value, label]}
        <button class="btn" class:soft={settings.theme !== value} role="radio" aria-checked={settings.theme === value}
          onclick={() => (settings.theme = value)}>{label}</button>
      {/each}
    </div>
    <label><input type="checkbox" bind:checked={settings.furigana} /> Hiện furigana (ふりがな)</label>
    <label><input type="checkbox" bind:checked={settings.largeText} /> Chữ lớn</label>
    <label><input type="checkbox" bind:checked={settings.highContrast} /> Tương phản cao</label>
  </section>

  <section class="card">
    <h2>Kho dữ liệu offline</h2>
    <p class="muted">Dữ liệu lưu ngay trên máy, không cần mạng. Gói nội dung được cài từng phần để cập nhật dần dần.</p>
    <button class="btn" onclick={loadDemo}>Cài gói mẫu (hiragana)</button>
    {#if status}<p role="status">{status}</p>{/if}
    <ul class="jp" lang="ja">
      {#each words as w (w.id)}
        <li><ruby>{w.kanji}<rt>{w.reading}</rt></ruby> — {w.meaning}</li>
      {/each}
    </ul>
  </section>
</main>

<style>
  main { max-width: 760px; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-4); }
  header { display: flex; align-items: center; gap: var(--space-3); }
  h1 { margin: 0; font-size: var(--text-xl); color: var(--accent-strong); }
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-3); }
  .feature { display: grid; gap: var(--space-2); justify-items: start; background: var(--surface-2); }
  .sample { font-size: var(--text-jp-reading); margin: 0; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
  label { display: block; padding: var(--space-1) 0; }
  input[type='checkbox'] { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); vertical-align: middle; }
</style>
