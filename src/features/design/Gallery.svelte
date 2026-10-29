<script lang="ts">
  // Living style guide: open the app with ?gallery to see every shared component in the current theme.
  import { Button, Toggle, Segmented, ProgressRing, ProgressBar, KeyCap, Mochi, NavBar, JpText, EmptyState, ErrorState, Skeleton, Slider, SkipLink, icons } from '../../lib/ui';
  let on = $state(true);
  let scale = $state(100);
  let dir = $state<'horizontal' | 'vertical'>('horizontal');
  let tab = $state('home');
  const items = [
    { id: 'home', label: 'Nhà', icon: icons.home }, { id: 'srs', label: 'Ôn tập', icon: icons.cards },
    { id: 'dict', label: 'Từ điển', icon: icons.book }, { id: 'me', label: 'Tiến độ', icon: icons.chart }
  ];
</script>

<SkipLink />
<main id="main">
  <h1>Thư viện thành phần</h1>
  <section class="card row"><Mochi mood="happy" /><Mochi mood="cheer" /><Mochi mood="sleepy" /></section>
  <section class="card row"><Button>Chính</Button><Button variant="soft">Phụ</Button><Button variant="ghost">Nhẹ</Button><Button disabled>Tắt</Button></section>
  <section class="card"><Toggle bind:checked={on} label="Hiện furigana" hint="Chữ nhỏ trên kanji" />
    <Segmented bind:value={dir} label="Hướng chữ" options={[['horizontal', 'Ngang'], ['vertical', 'Dọc']]} /></section>
  <section class="card row"><ProgressRing value={0.64} label="Mục tiêu hôm nay" /><div class="grow"><ProgressBar value={0.4} label="N5" /></div>
    <KeyCap k="Space" /><KeyCap k="←" /></section>
  <section class="card"><JpText parts={[['猫', 'ねこ'], ['は'], ['本', 'ほん'], ['を'], ['読', 'よ'], ['む。']]} /></section>
  <section class="card"><Slider bind:value={scale} min={100} max={200} step={25} label="Cỡ chữ" format={(v) => v + '%'} /></section>
  <EmptyState title="Chưa có thẻ nào" body="Thêm từ từ Từ điển để bắt đầu ôn tập."><Button>Mở Từ điển</Button></EmptyState>
  <ErrorState title="Không tải được" body="Thử lại sau vài giây." detail="IDBError: aborted"><Button>Thử lại</Button></ErrorState>
  <section class="card"><Skeleton lines={3} /></section>
  <NavBar {items} bind:current={tab} />
</main>

<style>
  main { max-width: 760px; margin: 0 auto; padding: var(--space-4); display: grid; gap: var(--space-4); }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .grow { flex: 1; min-width: 8rem; }
  h1 { margin: 0; color: var(--accent-strong); }
</style>
