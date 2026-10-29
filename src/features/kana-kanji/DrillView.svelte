<script lang="ts">
  // Ba kiểu bài tập: nghe đoán chữ, nhìn chữ đoán âm, nhìn âm đoán chữ. Có chế độ "nhanh" đếm ngược 4 giây.
  import { onDestroy } from 'svelte';
  import type { DB } from '../../lib/db';
  import type { Kana, Script } from './types';
  import { isCorrect, makeQuestions, summarizeDrill, type Answer, type DrillMode, type Question } from './drills';
  import { KANA_KNOWN_KEY, getKnown } from './model';
  import { canSpeak, hasJapaneseVoice, speak } from './speech';

  let { db, kana }: { db: DB; kana: Kana[] } = $props();

  const MODES: { id: DrillMode; label: string; note: string }[] = [
    { id: 'listen', label: '🔊 Nghe và chọn chữ', note: 'Nghe âm rồi chọn đúng chữ' },
    { id: 'char-to-romaji', label: 'Nhìn chữ, chọn âm', note: 'Hiện chữ, chọn cách đọc' },
    { id: 'romaji-to-char', label: 'Nhìn âm, chọn chữ', note: 'Hiện cách đọc, chọn chữ' }
  ];
  const ROUND = 10;
  const FAST_MS = 4000;

  let mode = $state<DrillMode>('char-to-romaji');
  let script = $state<Script>('hiragana');
  let withDakuten = $state(false);
  let fast = $state(false);
  let onlyKnown = $state(false);

  let questions = $state<Question[]>([]);
  let index = $state(0);
  let answers = $state<Answer[]>([]);
  let picked = $state<string | null>(null);
  let shownAt = 0;
  let timeLeft = $state(FAST_MS);
  let timer: ReturnType<typeof setInterval> | undefined;
  let error = $state('');
  let weakIds = $state<Set<string>>(new Set());

  const current = $derived(questions[index]);
  const finished = $derived(questions.length > 0 && index >= questions.length);
  const summary = $derived(summarizeDrill(answers));
  const byId = $derived(new Map(kana.map((k) => [k.id, k])));
  const voiceMissing = $derived(mode === 'listen' && (!canSpeak() || !hasJapaneseVoice()));

  async function start() {
    error = '';
    let pool = kana.filter((k) => k.script === script && (withDakuten || k.kind === 'basic'));
    if (onlyKnown) {
      const known = await getKnown(db, KANA_KNOWN_KEY);
      pool = pool.filter((k) => known.has(k.id));
    }
    if (pool.length < 4) { error = 'Cần ít nhất 4 chữ trong phạm vi đã chọn. Bỏ tick "chỉ chữ đã thuộc" hoặc học thêm chữ nhé.'; return; }
    questions = makeQuestions(pool, ROUND, mode, Math.random, weakIds);
    index = 0; answers = []; picked = null;
    show();
  }
  function show() {
    picked = null; shownAt = performance.now(); timeLeft = FAST_MS;
    clearInterval(timer);
    if (fast) timer = setInterval(() => { timeLeft -= 100; if (timeLeft <= 0) answer(null); }, 100);
    if (current?.mode === 'listen') speak(current.target.char);
  }
  function answer(choiceId: string | null) {
    if (picked !== null || !current) return;
    clearInterval(timer);
    picked = choiceId ?? '';
    const correct = choiceId !== null && isCorrect(current, choiceId);
    answers = [...answers, { id: current.target.id, correct, ms: Math.round(performance.now() - shownAt) }];
    setTimeout(() => {
      index++;
      if (index < questions.length) show();
      else weakIds = new Set(summarizeDrill(answers).weak);
    }, correct ? 450 : 1100);
  }
  onDestroy(() => clearInterval(timer));
</script>

{#if !questions.length || finished}
  <section class="card">
    {#if finished}
      <h2>Kết quả: {summary.correct}/{summary.total}</h2>
      <p>Chính xác {Math.round(summary.accuracy * 100)}%, trung bình {(summary.avgMs / 1000).toFixed(1)} giây mỗi câu.</p>
      {#if summary.weak.length}
        <p>Chữ cần luyện thêm:</p>
        <p class="jp weak" lang="ja">{#each summary.weak as id}<span>{byId.get(id)?.char}<small>{byId.get(id)?.romaji}</small></span>{/each}</p>
        <p class="muted">Lượt sau những chữ này sẽ xuất hiện nhiều hơn.</p>
      {:else}<p>Hoàn hảo! 🎉</p>{/if}
    {:else}
      <h2>Luyện nhận mặt chữ</h2>
    {/if}
    <div class="modes">
      {#each MODES as m}
        <button class="btn" class:soft={mode !== m.id} onclick={() => (mode = m.id)} aria-pressed={mode === m.id}>{m.label}</button>
      {/each}
    </div>
    <p class="muted">{MODES.find((m) => m.id === mode)?.note}</p>
    {#if voiceMissing}<p class="warn" role="alert">Máy chưa có giọng đọc tiếng Nhật. Hãy cài giọng Japanese trong cài đặt hệ thống, hoặc chọn kiểu bài khác.</p>{/if}
    <div class="opts">
      <label><input type="radio" bind:group={script} value="hiragana" /> Hiragana</label>
      <label><input type="radio" bind:group={script} value="katakana" /> Katakana</label>
      <label><input type="checkbox" bind:checked={withDakuten} /> Có chữ đục (が, ぱ...)</label>
      <label><input type="checkbox" bind:checked={onlyKnown} /> Chỉ chữ đã đánh dấu thuộc</label>
      <label><input type="checkbox" bind:checked={fast} /> Chế độ nhanh (4 giây mỗi câu)</label>
    </div>
    {#if error}<p class="warn" role="alert">{error}</p>{/if}
    <button class="btn" onclick={start}>{finished ? 'Chơi lại' : 'Bắt đầu'} ({ROUND} câu)</button>
  </section>
{:else if current}
  <section class="card quiz">
    <p class="muted">Câu {index + 1}/{questions.length}</p>
    {#if fast}<div class="bar" aria-hidden="true"><i style="width:{(timeLeft / FAST_MS) * 100}%"></i></div>{/if}
    {#if current.mode === 'listen'}
      <button class="btn soft big-btn" onclick={() => speak(current.target.char)} aria-label="Nghe lại">🔊 Nghe lại</button>
    {:else if current.mode === 'char-to-romaji'}
      <p class="prompt jp" lang="ja">{current.target.char}</p>
    {:else}
      <p class="prompt">{current.target.romaji}</p>
    {/if}
    <div class="choices">
      {#each current.choices as c (c.id)}
        {@const right = isCorrect(current, c.id)}
        <button class="choice" class:jp={current.mode !== 'char-to-romaji'} lang={current.mode !== 'char-to-romaji' ? 'ja' : undefined}
          class:right={picked !== null && right} class:wrong={picked === c.id && !right} disabled={picked !== null} onclick={() => answer(c.id)}>
          {current.mode === 'char-to-romaji' ? c.romaji : c.char}
        </button>
      {/each}
    </div>
    {#if picked !== null && !isCorrect(current, picked)}
      <p class="warn" role="status">{picked === '' ? 'Hết giờ! ' : ''}Đáp án: <span class="jp" lang="ja">{current.target.char}</span> = {current.target.romaji}</p>
    {/if}
  </section>
{/if}

<style>
  h2 { margin: 0 0 var(--space-2); font-size: var(--text-lg); }
  .muted { color: var(--text-muted); margin: 0 0 var(--space-3); }
  .modes, .opts { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
  .opts { flex-direction: column; gap: 0; }
  .warn { color: var(--warn-text, #b0522a); background: var(--warn-soft); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); }
  :global(:root[data-theme='dark']) .warn { color: var(--warn); }
  .weak { display: flex; gap: var(--space-3); flex-wrap: wrap; font-size: var(--text-jp-reading); margin: 0; }
  .weak small { display: block; font-size: var(--text-sm); color: var(--text-muted); text-align: center; }
  .quiz { display: grid; gap: var(--space-3); justify-items: center; }
  .prompt { font-size: 4.5rem; margin: 0; line-height: 1.2; color: var(--accent-strong); font-weight: 800; }
  .big-btn { font-size: var(--text-lg); min-height: 72px; }
  .choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); width: 100%; max-width: 420px; }
  .choice { min-height: 64px; font-size: calc(1.6rem * var(--font-scale)); border: 2px solid var(--border); border-radius: var(--radius); background: var(--surface-2); }
  .choice.right { background: var(--success-soft); border-color: var(--success); }
  .choice.wrong { background: var(--warn-soft); border-color: #d9534f; }
  .bar { width: 100%; height: 8px; border-radius: 99px; background: var(--border); overflow: hidden; }
  .bar i { display: block; height: 100%; background: var(--accent); transition: width .1s linear; }
  input { width: 1.1rem; height: 1.1rem; accent-color: var(--accent); vertical-align: middle; }
  label { padding: var(--space-1) 0; }
</style>
