<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import { DEFAULT_PARAMS, formatInterval, newCard, previewIntervals, type Rating } from './fsrs';
  import { chooseType, makeQuestion, type Question } from './questions';
  import { ReviewSession } from './session';
  import { deleteState, dayKey, loadCards, loadSettings, loadStates, loadStats, saveState, saveStats } from './store';
  import type { CardContent } from './types';
  import { canSpeak, speak } from './tts';
  import { recordSession } from '../progress/store';
  import type { SessionSummary } from '../progress/types';
  import Handwriting from './Handwriting.svelte';

  let { db, quick = false, onexit }: { db: DB; quick?: boolean; onexit: (summary?: SessionSummary) => void } = $props();

  let session = $state.raw<ReviewSession>();
  let pool: CardContent[] = [];
  let question = $state.raw<Question>();
  let revealed = $state(false);
  let picked = $state<number | undefined>();
  let now = $state(Date.now());
  let total = $state(0);
  let ticker: ReturnType<typeof setInterval>;
  let startedAt = Date.now();

  const labels: [Rating, string, string][] = [[1, 'Quên', 'again'], [2, 'Khó', 'hard'], [3, 'Tốt', 'good'], [4, 'Dễ', 'easy']];

  onMount(async () => {
    const [cards, states, settings] = await Promise.all([loadCards(db), loadStates(db), loadSettings(db)]);
    pool = cards;
    const t = Date.now();
    session = new ReviewSession(cards, states, settings, await loadStats(db, dayKey(t)), {
      saveState: async (s) => { await saveState(db, s); },
      deleteState: (id) => deleteState(db, id),
      saveStats: async (day, s) => { await saveStats(db, day, s); }
    }, { now: t, quick });
    startedAt = t;
    total = session.remaining;
    next();
    ticker = setInterval(() => (now = Date.now()), 250);
  });
  onDestroy(() => clearInterval(ticker));

  let settingsTypes = ['meaning', 'audio', 'handwrite', 'blank'] as const;
  async function next() {
    revealed = false; picked = undefined;
    const card = session?.currentCard;
    if (!session || !card) { question = undefined; return; }
    const settings = await loadSettings(db);
    const reps = session.currentState()?.reps ?? 0;
    question = makeQuestion(card, chooseType(card, reps, settings.types ?? [...settingsTypes]), pool);
    if (question.type === 'audio') speak(card.reading);
  }

  const finished = $derived(!!session && (!question || session.finished(now)));
  const secondsLeft = $derived(session?.deadline ? Math.max(0, Math.ceil((session.deadline - now) / 1000)) : undefined);
  const undoLeft = $derived(session ? session.undoMsLeft(now) : 0);

  const isChoice = (q: Question) => q.type === 'meaning' || q.type === 'audio' || q.type === 'blank';
  const correct = $derived(question && isChoice(question) && picked !== undefined ? picked === (question as { answer: number }).answer : undefined);
  const suggested = $derived<Rating | undefined>(correct === undefined ? undefined : correct ? 3 : 1);

  const intervals = $derived.by(() => {
    if (!session || !session.currentCard) return [];
    const params = { ...DEFAULT_PARAMS };
    return previewIntervals(session.currentState() ?? newCard(now), now, params);
  });

  const canRate = $derived(!!question && (revealed || (isChoice(question) && picked !== undefined)));

  async function rate(r: Rating) { await session!.answer(r, Date.now()); await next(); }
  async function skip() { await session!.bury(Date.now()); await next(); }
  async function undo() { if (await session!.undo(Date.now())) await next(); }
  /** Hands the finished session to the Progress feature (streak, goal, history), then leaves. */
  async function leave() {
    let summary: SessionSummary | undefined;
    if (session?.answerLog.length) {
      const byId = new Map(pool.map((c) => [c.id, c]));
      const end = Date.now();
      summary = await recordSession(db, {
        endedAt: end, seconds: Math.round((end - startedAt) / 1000), source: 'SRS',
        items: session.answerLog.map((a) => {
          const c = byId.get(a.cardId)!;
          return { kind: 'word' as const, id: a.cardId, label: `${c.word} (${c.reading})`, correct: a.correct, learned: a.learned };
        })
      });
    }
    onexit(summary);
  }
  const pick = (i: number) => { if (picked === undefined) picked = i; };
</script>

<section class="review" aria-live="polite">
  <div class="top">
    <button class="btn soft" onclick={leave}>← Thoát</button>
    {#if session}
      <span class="chip pink">Còn {session.remaining} thẻ</span>
      {#if secondsLeft !== undefined}
        <span class="chip butter" aria-label="Thời gian còn lại">⏱ {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
      {/if}
    {/if}
  </div>

  {#if !session}
    <p class="muted">Đang chuẩn bị thẻ…</p>
  {:else if finished}
    <div class="card done">
      <img src="favicon.svg" alt="Mochi" width="72" height="72" />
      <h2>{total === 0 ? 'Hôm nay chưa có thẻ cần ôn' : session.answered ? 'Hoàn thành!' : 'Hết giờ rồi!'}</h2>
      <p>Bạn đã ôn <strong>{session.answered}</strong> lượt trong phiên này.
        {#if session.remaining > 0}Còn {session.remaining} thẻ, mai Mochi sẽ nhắc tiếp.{/if}</p>
      <div class="row">
        {#if undoLeft > 0}<button class="btn soft" onclick={undo}>↶ Hoàn tác ({Math.ceil(undoLeft / 1000)}s)</button>{/if}
        <button class="btn" onclick={leave}>Về trang chính</button>
      </div>
    </div>
  {:else if question}
    {@const q = question}
    <div class="card q">
      {#if q.type === 'meaning'}
        <p class="hint">Chọn nghĩa đúng của từ này</p>
        <p class="big jp" lang="ja">{q.card.reading}</p>
      {:else if q.type === 'audio'}
        <p class="hint">Nghe và chọn chữ Hán đúng</p>
        <button class="btn" onclick={() => speak(q.card.reading)} disabled={!canSpeak()}>🔊 Nghe lại</button>
        {#if !canSpeak()}<p class="muted">Máy này chưa có giọng đọc tiếng Nhật. Hãy tắt dạng câu hỏi này trong Cài đặt.</p>{/if}
      {:else if q.type === 'blank'}
        <p class="hint">Điền từ còn thiếu vào chỗ trống</p>
        <p class="big jp" lang="ja">{q.sentence}</p>
        {#if q.card.example?.vi}<p class="muted">{q.card.example.vi}</p>{/if}
      {:else if q.type === 'handwrite'}
        <p class="hint">Viết tay chữ Hán của từ này</p>
        <p class="big">{q.card.meaning}</p>
        <p class="jp" lang="ja">{q.card.reading}</p>
        <Handwriting />
      {:else}
        <p class="hint">Bạn có nhớ từ này không?</p>
        <p class="big jp" lang="ja">{q.card.word}</p>
      {/if}

      {#if isChoice(q)}
        <div class="choices" role="group" aria-label="Các lựa chọn">
          {#each (q as { choices: string[] }).choices as c, i}
            <button class="choice" class:ok={picked !== undefined && i === (q as { answer: number }).answer}
              class:bad={picked === i && i !== (q as { answer: number }).answer}
              class:jp={q.type !== 'meaning'} lang={q.type === 'meaning' ? undefined : 'ja'}
              disabled={picked !== undefined} onclick={() => pick(i)}>{c}</button>
          {/each}
        </div>
      {:else if !revealed}
        <button class="btn" onclick={() => (revealed = true)}>Xem đáp án</button>
      {/if}

      {#if canRate}
        <div class="answer">
          <p class="jp big" lang="ja"><ruby>{q.card.word}<rt>{q.card.reading}</rt></ruby></p>
          <p>{q.card.meaning}</p>
          {#if correct !== undefined}<p class="verdict" class:ok={correct}>{correct ? '✔ Chính xác!' : '✘ Chưa đúng, Mochi sẽ cho ôn lại sớm'}</p>{/if}
        </div>
        <div class="rate" role="group" aria-label="Bạn nhớ thẻ này tới mức nào?">
          {#each labels as [r, text, cls]}
            <button class="rbtn {cls}" class:suggest={suggested === r} onclick={() => rate(r)}>
              <strong>{text}</strong><small>{intervals[r - 1] !== undefined ? formatInterval(intervals[r - 1]) : ''}</small>
            </button>
          {/each}
        </div>
      {/if}
      <button class="link" onclick={skip}>Để sau (ẩn tới ngày mai)</button>
    </div>
  {/if}

  {#if undoLeft > 0 && !finished}
    <div class="toast" role="status">
      <span>Đã lưu.</span>
      <button class="btn soft" onclick={undo}>↶ Hoàn tác ({Math.ceil(undoLeft / 1000)}s)</button>
    </div>
  {/if}
</section>

<style>
  .review { display: grid; gap: var(--space-3); }
  .top { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
  .q { display: grid; gap: var(--space-3); justify-items: center; text-align: center; }
  .hint, .muted { color: var(--text-muted); margin: 0; }
  .big { font-size: var(--text-xl); margin: 0; }
  .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--space-2); width: 100%; }
  .choice {
    min-height: 56px; padding: var(--space-2) var(--space-3); border-radius: var(--radius);
    border: 2px solid var(--border); background: var(--surface-2, var(--surface)); font-size: var(--text-lg);
  }
  .choice:not(:disabled):hover { border-color: var(--accent); }
  .choice.ok { border-color: var(--success); background: var(--success-soft); }
  .choice.bad { border-color: var(--warn); background: var(--warn-soft); }
  .answer { border-top: 1px dashed var(--border); padding-top: var(--space-3); width: 100%; }
  .answer p { margin: 0 0 var(--space-1); }
  .verdict { font-weight: 700; color: var(--warn); }
  .verdict.ok { color: var(--success); }
  .rate { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); width: 100%; }
  .rbtn {
    display: grid; gap: 2px; min-height: 56px; padding: var(--space-2); border-radius: var(--radius);
    border: 2px solid transparent; font-size: var(--text-md);
  }
  .rbtn small { font-size: var(--text-sm); opacity: .85; }
  .rbtn.again { background: var(--warn-soft); }
  .rbtn.hard { background: var(--butter-100); color: #7a5b00; }
  .rbtn.good { background: var(--success-soft); }
  .rbtn.easy { background: var(--sky-100); color: #2c5d8f; }
  :root[data-theme='dark'] .rbtn.hard { background: #4a4126; color: #f2d98a; }
  :root[data-theme='dark'] .rbtn.easy { background: #263a4f; color: #a9d0f5; }
  .rbtn.suggest { border-color: var(--accent-strong); }
  .link { background: none; border: 0; color: var(--text-muted); text-decoration: underline; min-height: 44px; }
  .toast {
    position: sticky; bottom: var(--space-3); display: flex; justify-content: space-between; align-items: center;
    gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-pill);
    background: var(--surface); border: 1px solid var(--border); box-shadow: var(--shadow);
  }
  .done { display: grid; gap: var(--space-3); justify-items: center; text-align: center; }
  .done h2 { margin: 0; }
  .row { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; }
</style>
