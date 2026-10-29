<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { listCollection, getUserData, setUserData, type DB } from '../../lib/db';
  import { cueAt, parseSubtitles, type Cue } from './subtitles';
  import { buildIndex, tokenize, type DictEntry, type DictIndex, type Token } from './tokenizer';
  import { comprehension } from './comprehension';
  import { loadKnown, saveKnown, loadCards, planCards, saveNewCards, tokenizeCues, type NewCard } from './store';
  import { compareRecordings, type ShadowResult } from './shadowing';
  import { captureCueAudio, decodeToPcm, recordLearner } from './audio';

  let { db, onclose }: { db: DB; onclose?: () => void } = $props();

  let videoEl = $state<HTMLVideoElement>();
  let videoUrl = $state('');
  let videoKey = '';
  let subName = $state('');
  let cues = $state<Cue[]>([]);
  let index = $state<DictIndex>(new Map());
  let known = $state<Set<string>>(new Set());
  let cards = $state<NewCard[]>([]);
  let now = $state(0);
  let selected = $state<Token>();
  let message = $state('');
  let loopCue = $state(false);

  const lines = $derived(tokenizeCues(cues, index, tokenize));
  const active = $derived(cueAt(cues, now));
  const activeTokens = $derived(active >= 0 ? lines[active].tokens : []);
  const score = $derived(comprehension(lines.map((l) => l.tokens), known));
  const vocab = $derived(comprehension(lines.map((l) => l.tokens), known, true));
  const activeScore = $derived(active >= 0 ? comprehension([activeTokens], known) : undefined);

  onMount(async () => {
    index = buildIndex((await listCollection(db, 'words')) as unknown as DictEntry[]);
    known = await loadKnown(db);
    cards = await loadCards(db);
  });
  onDestroy(() => videoUrl && URL.revokeObjectURL(videoUrl));

  // ---- loading the learner's own files (nothing is uploaded anywhere) ----
  async function readText(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { return new TextDecoder('shift_jis').decode(buf); } // old subtitle files
  }
  async function pickVideo(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(f);
    videoKey = `anime.position:${f.name}:${f.size}`;
  }
  async function pickSubs(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    cues = parseSubtitles(await readText(f));
    subName = f.name;
    message = cues.length ? `Đã đọc ${cues.length} câu phụ đề.` : 'Không đọc được câu nào. Hãy thử file .srt, .vtt hoặc .ass.';
  }
  async function restorePosition() {
    const t = videoKey ? await getUserData<number>(db, videoKey) : undefined;
    if (videoEl && t) videoEl.currentTime = t;
  }
  let lastSaved = 0;
  function onTime() {
    now = videoEl!.currentTime;
    if (loopCue && active >= 0 && now >= cues[active].end - 0.05) videoEl!.currentTime = cues[active].start;
    if (videoKey && Math.abs(now - lastSaved) > 5) { lastSaved = now; void setUserData(db, videoKey, now); }
  }

  // ---- words ----
  function pick(t: Token) {
    if (!t.countable) return;
    selected = t;
  }
  function pickAndPause(t: Token) { if (t.countable) videoEl?.pause(); pick(t); }
  async function toggleKnown(t: Token) {
    const next = new Set(known);
    next.has(t.key) ? next.delete(t.key) : next.add(t.key);
    known = next;
    await saveKnown(db, next);
  }
  async function addCard(t: Token, cue?: Cue) {
    const sentence = (cue ?? cues[active])?.text.replace(/\n/g, ' ') ?? '';
    const plan = planCards([{ cue: { index: 0, start: 0, end: 0, text: sentence }, tokens: [t] }], known, cards, subName || 'anime');
    const n = await saveNewCards(db, plan);
    cards = await loadCards(db);
    message = n ? `Đã thêm thẻ “${plan.cards[0].word}”.` : t.entry ? 'Thẻ này đã có rồi.' : 'Từ này chưa có trong từ điển nên chưa tạo được thẻ.';
  }
  async function cardsFromFile() {
    const plan = planCards(lines, known, cards, subName);
    const n = await saveNewCards(db, plan);
    cards = await loadCards(db);
    message = `Đã tạo ${n} thẻ từ mới.` + (plan.skippedNoMeaning ? ` ${plan.skippedNoMeaning} từ chưa có nghĩa trong từ điển nên bị bỏ qua.` : '');
  }

  // ---- player controls ----
  function seekCue(i: number) {
    const c = cues[i];
    if (c && videoEl) { videoEl.currentTime = c.start; void videoEl.play(); } else now = c?.start ?? now;
  }
  const step = (d: number) => seekCue(Math.max(0, Math.min(cues.length - 1, (active < 0 ? cues.findIndex((c) => c.start > now) - 1 : active) + d)));

  // ---- shadowing ----
  let shadowState = $state<'idle' | 'listening' | 'recording' | 'scoring'>('idle');
  let result = $state<ShadowResult>();
  let stopRec: (() => Promise<{ blob: Blob; heard: string }>) | undefined;
  let reference = $state<Blob | null>(null);
  let learnerUrl = $state('');

  async function listenModel() {
    if (!videoEl || active < 0) return;
    shadowState = 'listening';
    reference = await captureCueAudio(videoEl, cues[active]);
    if (!reference) message = 'Trình duyệt này không lấy được âm thanh mẫu từ video, nên chỉ so được chữ.';
    shadowState = 'idle';
  }
  async function startShadow() {
    try {
      message = '';
      result = undefined;
      const r = await recordLearner();
      stopRec = r.stop;
      shadowState = 'recording';
    } catch {
      message = 'Không mở được micro. Hãy cho phép dùng micro trong trình duyệt.';
    }
  }
  async function stopShadow() {
    if (!stopRec) return;
    shadowState = 'scoring';
    const { blob, heard } = await stopRec();
    if (learnerUrl) URL.revokeObjectURL(learnerUrl);
    learnerUrl = URL.createObjectURL(blob);
    try {
      const me = await decodeToPcm(blob);
      const text = cues[active]?.text ?? '';
      if (reference) {
        const ref = await decodeToPcm(reference);
        result = compareRecordings(ref.samples, me.samples, me.sampleRate, heard ? { expectedText: text, heardText: heard } : {});
      } else if (heard) {
        const t = compareRecordings(me.samples, me.samples, me.sampleRate, { expectedText: text, heardText: heard });
        result = { sound: 0, pace: 0, text: t.text, overall: t.text ?? 0 };
      } else {
        message = 'Chưa có âm thanh mẫu. Bấm “Nghe mẫu” trước khi đọc theo.';
      }
    } catch {
      message = 'Không xử lý được bản ghi âm.';
    }
    shadowState = 'idle';
  }

  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
</script>

<section class="player">
  <div class="top">
    <button class="btn soft" onclick={onclose}>← Quay lại</button>
    <h2>Xem anime có phụ đề</h2>
  </div>

  <div class="card pick">
    <label class="btn soft file">🎬 Chọn video<input type="file" accept="video/*,.mkv" onchange={pickVideo} hidden /></label>
    <label class="btn soft file">💬 Chọn phụ đề (.srt .vtt .ass)<input type="file" accept=".srt,.vtt,.ass,.ssa,text/*" onchange={pickSubs} hidden /></label>
    <p class="muted">Video và phụ đề ở lại trên máy bạn, không tải đi đâu. Yomineko không kèm sẵn anime nào.</p>
  </div>

  {#if videoUrl}
    <div class="stage">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={videoEl} src={videoUrl} controls ontimeupdate={onTime} onloadedmetadata={restorePosition}></video>
      {#if activeTokens.length}
        <div class="overlay jp" lang="ja" aria-live="polite">
          {#each activeTokens as t}
            {#if t.countable}
              <button class="tok" class:known={known.has(t.key)} onmouseenter={() => pick(t)} onfocus={() => pick(t)} onclick={() => pickAndPause(t)}>{t.surface}</button>
            {:else}{t.surface}{/if}
          {/each}
        </div>
      {/if}
    </div>
  {:else if cues.length}
    <p class="muted">Chưa chọn video. Bạn vẫn có thể xem danh sách phụ đề, điểm hiểu và tạo thẻ.</p>
  {/if}

  {#if selected}
    <div class="card word" role="status">
      <strong class="jp" lang="ja">{selected.entry?.kanji ?? selected.surface}</strong>
      {#if selected.entry}
        <span class="jp" lang="ja">{selected.entry.reading}</span> — {selected.entry.meaning}
      {:else}
        <span class="muted">Chưa có trong từ điển (nội dung từ điển sẽ đến từ gói JMdict).</span>
      {/if}
      <div class="row">
        <button class="btn soft" onclick={() => toggleKnown(selected!)}>{known.has(selected.key) ? 'Bỏ “đã biết”' : '✓ Đã biết'}</button>
        <button class="btn" onclick={() => addCard(selected!)}>+ Tạo thẻ</button>
      </div>
    </div>
  {/if}

  {#if message}<p role="status" class="msg">{message}</p>{/if}

  {#if cues.length}
    <div class="card scores">
      <div><span class="big">{score.percent}%</span><br /><span class="muted">Điểm hiểu cả tập ({score.known}/{score.total} từ)</span></div>
      <div><span class="big">{vocab.percent}%</span><br /><span class="muted">Từ vựng khác nhau biết được</span></div>
      {#if activeScore}<div><span class="big">{activeScore.percent}%</span><br /><span class="muted">Câu đang xem</span></div>{/if}
      <button class="btn" onclick={cardsFromFile}>Tạo thẻ cho {score.unknownKeys.length} từ mới</button>
    </div>

    <div class="card shadow">
      <h3>Đọc theo (shadowing)</h3>
      <p class="muted">Chọn một câu → nghe mẫu → đọc lại → xem điểm giống âm thanh gốc.</p>
      <div class="row">
        <button class="btn soft" onclick={() => step(-1)}>⏮ Câu trước</button>
        <button class="btn soft" onclick={() => seekCue(active)} disabled={active < 0}>↺ Phát lại câu</button>
        <button class="btn soft" onclick={() => step(1)}>Câu sau ⏭</button>
        <label><input type="checkbox" bind:checked={loopCue} /> Lặp câu</label>
      </div>
      <div class="row">
        <button class="btn soft" onclick={listenModel} disabled={!videoUrl || active < 0 || shadowState !== 'idle'}>🔊 Nghe mẫu</button>
        {#if shadowState === 'recording'}
          <button class="btn" onclick={stopShadow}>■ Dừng &amp; chấm điểm</button>
        {:else}
          <button class="btn" onclick={startShadow} disabled={active < 0 || shadowState !== 'idle'}>🎤 Đọc theo</button>
        {/if}
        {#if shadowState === 'listening'}<span class="chip">Đang phát mẫu…</span>{/if}
        {#if shadowState === 'scoring'}<span class="chip">Đang chấm…</span>{/if}
      </div>
      {#if learnerUrl}<audio src={learnerUrl} controls></audio>{/if}
      {#if result}
        <div class="row results" role="status">
          <span class="chip pink">Tổng: {result.overall}/100</span>
          {#if reference}<span class="chip mint">Âm thanh: {result.sound}</span><span class="chip sky">Nhịp độ: {result.pace}</span>{/if}
          {#if result.text !== undefined}<span class="chip butter">Chữ nghe được: {result.text}</span>{/if}
        </div>
      {/if}
    </div>

    <div class="card">
      <h3>Phụ đề ({subName})</h3>
      <ol class="cues">
        {#each lines as { cue, tokens } (cue.index)}
          <li class:now={cue.index === active}>
            <button class="time" onclick={() => seekCue(cue.index)}>{fmt(cue.start)}</button>
            <span class="jp" lang="ja">
              {#each tokens as t}
                {#if t.countable}<button class="tok" class:known={known.has(t.key)} onclick={() => pick(t)}>{t.surface}</button>{:else}{t.surface}{/if}
              {/each}
            </span>
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</section>

<style>
  .player { display: grid; gap: var(--space-3); }
  .top { display: flex; align-items: center; gap: var(--space-3); }
  h2, h3 { margin: 0; }
  h3 { font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: 0; }
  .pick { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .file { cursor: pointer; display: inline-flex; align-items: center; }
  .stage { position: relative; background: #000; border-radius: var(--radius-lg, 16px); overflow: hidden; }
  video { width: 100%; display: block; max-height: 70vh; }
  .overlay { position: absolute; left: 0; right: 0; bottom: 3.5rem; text-align: center; font-size: var(--text-jp-reading, 1.4rem); color: #fff; text-shadow: 0 0 4px #000, 0 0 2px #000; padding: 0 var(--space-3); pointer-events: none; }
  .tok { pointer-events: auto; background: transparent; border: 0; border-bottom: 2px dotted transparent; color: inherit; font: inherit; padding: 0; margin: 0; cursor: pointer; min-height: 0; }
  .tok:hover, .tok:focus-visible { background: color-mix(in srgb, var(--accent) 35%, transparent); border-bottom-color: currentColor; outline: none; }
  .tok.known { opacity: .6; }
  .word { display: grid; gap: var(--space-2); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .scores { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: center; }
  .big { font-size: var(--text-xl); font-weight: 700; color: var(--accent-strong); }
  .shadow { display: grid; gap: var(--space-2); }
  .msg { margin: 0; }
  .cues { list-style: none; margin: 0; padding: 0; max-height: 40vh; overflow: auto; display: grid; gap: var(--space-1); }
  .cues li { display: flex; gap: var(--space-2); padding: var(--space-1); border-radius: 8px; }
  .cues li.now { background: var(--accent-soft); }
  .time { background: none; border: 0; color: var(--text-muted); cursor: pointer; font-variant-numeric: tabular-nums; min-width: 3rem; }
</style>
