<script lang="ts">
  import { onMount } from 'svelte';
  import type { DB } from '../../lib/db';
  import AudioButton from './AudioButton.svelte';
  import SourceBadge from './SourceBadge.svelte';
  import ExercisePanel from './ExercisePanel.svelte';
  import { availableSections, effectiveSource, lessonRatio } from './logic';
  import { speak } from './audio';
  import { addLessonToSrs, srsCardCount } from './srs';
  import { loadNotes, loadProgress, resetLesson, saveNotes, setSectionDone } from './store';
  import { emptyProgress, type Lesson, type LessonProgress, type SectionId } from './types';

  let { db, lesson, prev, next, onback, onopen, onprogress, hasBookFile = false, onreadbook }: {
    db: DB; lesson: Lesson; hasBookFile?: boolean; onreadbook?: () => void; prev?: Lesson; next?: Lesson;
    onback: () => void; onopen: (l: Lesson) => void; onprogress: () => void;
  } = $props();

  type Tab = 'guide' | 'vocab' | 'grammar' | 'dialogue' | 'practice' | 'video';
  const NAMES: Record<SectionId, [string, string]> = {
    guide: ['案内', 'Hướng dẫn'], vocab: ['語彙', 'Từ vựng'], grammar: ['文型', 'Ngữ pháp'],
    dialogue: ['会話', 'Hội thoại'], practice: ['練習', 'Bài tập']
  };

  let progress = $state<LessonProgress>(emptyProgress());
  let tab = $state<Tab>('guide');
  let notes = $state('');
  let srsCount = $state(0);
  let srsNote = $state('');
  let showVi = $state(true);
  let notesTimer: ReturnType<typeof setTimeout> | undefined;

  const sections = $derived(availableSections(lesson));
  const ratio = $derived(lessonRatio(lesson, progress));
  const percent = $derived(Math.round(ratio * 100));
  const tabs = $derived<[Tab, string][]>([
    ...sections.map((s): [Tab, string] => [s, NAMES[s][1]]),
    ...(lesson.videos?.length ? [['video', 'Video'] as [Tab, string]] : [])
  ]);

  onMount(load);
  $effect(() => { lesson.id; load(); });

  async function load() {
    progress = await loadProgress(db, lesson.id);
    notes = await loadNotes(db, lesson.id);
    srsCount = await srsCardCount(db, lesson.id);
    srsNote = '';
    tab = tabs[0]?.[0] ?? 'guide';
  }
  async function toggle(s: SectionId) {
    progress = await setSectionDone(db, lesson.id, s, !progress.done[s]);
    onprogress();
  }
  function changed(p: LessonProgress) { progress = p; onprogress(); }
  async function toSrs() {
    const n = await addLessonToSrs(db, lesson);
    srsCount = n;
    srsNote = n ? `Đã đưa ${n} thẻ vào hàng chờ ôn tập (SRS).` : 'Bài này chưa có từ vựng hay ngữ pháp để ôn.';
  }
  function editNotes() {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => saveNotes(db, lesson.id, notes), 400);
  }
  async function reset() { await resetLesson(db, lesson.id); await load(); onprogress(); }
</script>

<div class="stack">
  <div class="row">
    <button class="btn soft back" type="button" onclick={onback}>‹ Mục lục</button>
    {#if hasBookFile}<button class="btn soft" type="button" onclick={onreadbook}>Mở trang sách</button>{/if}
  </div>

  <header class="head">
    <div>
      {#if lesson.titleJa}<span class="chip pink" lang="ja">{lesson.titleJa}</span>{/if}
      <h2>Bài {lesson.order} · {lesson.title}</h2>
    </div>
    <div class="big" aria-label={`Hoàn thành ${percent} phần trăm`}>{percent}<small>%</small></div>
  </header>
  <progress max="1" value={ratio} aria-label={`Tiến độ bài ${lesson.order}`}></progress>

  {#if !sections.length}
    <div class="card empty">
      <strong>Bài này chưa có nội dung</strong>
      <p class="muted">Giáo trình này chỉ có khung bài. Hãy nạp file bài học của bạn (nút "Thêm giáo trình" ở trang giáo trình) để điền từ vựng, ngữ pháp, hội thoại và bài tập. Mẫu file nằm trong README.</p>
    </div>
  {:else}
    <div class="strip" role="group" aria-label="Các phần của bài">
      {#each sections as s}
        <button type="button" class="step" class:done={progress.done[s]} aria-pressed={!!progress.done[s]}
          onclick={() => (tab = s)}>
          <span class="l" lang="ja">{NAMES[s][0]}</span>
          <span>{progress.done[s] ? '✓' : '○'} {NAMES[s][1]}</span>
        </button>
      {/each}
    </div>

    <div class="tabs" role="tablist" aria-label="Phần của bài">
      {#each tabs as [id, label]}
        <button role="tab" type="button" class="btn" class:soft={tab !== id} aria-selected={tab === id} onclick={() => (tab = id)}>{label}</button>
      {/each}
    </div>

    <div class="layout">
      <section class="card" role="tabpanel">
        {#if tab === 'guide'}
          <h3>Cách học bài này</h3>
          <ol class="tips">{#each lesson.guide ?? [] as g}<li>{g}</li>{/each}</ol>
        {:else if tab === 'vocab'}
          {#if lesson.vocab?.length}
            <ul class="rows">
              {#each lesson.vocab as v, i (v.id)}
                <li>
                  <span class="no" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span class="jp big-jp" lang="ja">{#if v.reading}<ruby>{v.word}<rt>{v.reading}</rt></ruby>{:else}{v.word}{/if}</span>
                  <span class="grow">{v.meaning}</span>
                  <AudioButton {db} lessonId={lesson.id} audioKey={v.audio ?? `vocab-${v.id}`} text={v.reading ?? v.word} label="Nghe" />
                  <span class="src"><SourceBadge source={effectiveSource(v, lesson)} /></span>
                </li>
              {/each}
            </ul>
          {/if}
          {#if lesson.kanji?.length}
            <h3>Kanji của bài</h3>
            <ul class="kanji">
              {#each lesson.kanji as k (k.id)}
                <li class="card"><span class="jp k" lang="ja">{k.char}</span><span lang="ja" class="muted">{k.reading ?? ''}</span><span>{k.meaning}</span><SourceBadge source={effectiveSource(k, lesson)} /></li>
              {/each}
            </ul>
          {/if}
        {:else if tab === 'grammar'}
          <div class="stack">
            {#each lesson.grammar ?? [] as g, i (g.id)}
              <article class="card soft stack">
                <span class="row"><span class="chip butter">文型 {i + 1}</span><SourceBadge source={effectiveSource(g, lesson)} /></span>
                <strong class="jp pattern" lang="ja">{g.pattern}</strong>
                <span><strong>{g.title}.</strong> {g.explanation}</span>
                {#each g.examples as ex}
                  <div class="ex jp" lang="ja">{#if ex.reading}<ruby>{ex.ja}<rt>{ex.reading}</rt></ruby>{:else}{ex.ja}{/if}
                    <div class="muted vi" lang="vi">{ex.vi}</div></div>
                {/each}
              </article>
            {/each}
          </div>
        {:else if tab === 'dialogue'}
          <div class="stack">
            <label class="toggle"><input type="checkbox" bind:checked={showVi} /> Hiện bản dịch</label>
            {#each lesson.dialogues ?? [] as d (d.id)}
              <article class="stack">
                <div class="row">
                  <strong>{d.title}</strong>
                  <SourceBadge source={effectiveSource(d, lesson)} />
                  <AudioButton {db} lessonId={lesson.id} audioKey={d.audio ?? `dialogue-${d.id}`} text={d.lines.map((l) => l.ja).join('。')} label="Nghe cả hội thoại" />
                </div>
                <div class="tr jp" lang="ja">
                  {#each d.lines as line}
                    <button type="button" onclick={() => speak(line.ja)} aria-label={`Nghe câu của ${line.speaker}: ${line.ja}`}>
                      <span class="who">{line.speaker}</span>
                      <span>{line.ja}{#if showVi}<span class="muted vi" lang="vi">{line.vi}</span>{/if}{#if line.source}<span class="vi"><SourceBadge source={line.source} /></span>{/if}</span>
                    </button>
                  {/each}
                </div>
              </article>
            {/each}
          </div>
        {:else if tab === 'practice'}
          <ExercisePanel {db} {lesson} {progress} onchange={changed} />
        {:else if tab === 'video'}
          <div class="stack">
            {#each lesson.videos ?? [] as v (v.id)}
              <div class="card soft video">
                <span class="play" aria-hidden="true">▶</span>
                <div class="grow"><strong>{v.title}</strong>
                  <p class="muted">{v.note ?? 'Chỗ dành cho video bài giảng ngắn. Sắp có: gắn video của bạn hoặc đường link mở.'}</p>
                  {#if v.url}<a href={v.url} target="_blank" rel="noopener noreferrer">Mở video</a>{/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if tab !== 'video' && tab !== 'practice' && sections.includes(tab as SectionId)}
          <p class="mark"><button class="btn" class:soft={progress.done[tab as SectionId]} type="button" onclick={() => toggle(tab as SectionId)}>
            {progress.done[tab as SectionId] ? 'Bỏ đánh dấu đã học' : 'Đánh dấu đã học xong phần này'}</button></p>
        {:else if tab === 'practice'}
          <p class="muted">Phần này tự tính là xong khi bạn làm đúng tất cả câu.</p>
        {/if}
      </section>

      <aside class="stack">
        <section class="card tint stack">
          <span class="chip butter" lang="ja">メモ</span>
          <strong>Ghi chú của bạn</strong>
          <textarea bind:value={notes} oninput={editNotes} aria-label={`Ghi chú bài ${lesson.order}`} placeholder="Ghi chú riêng cho bài này, tự lưu trong máy."></textarea>
        </section>
        <section class="card soft stack">
          <strong>Ôn lại bằng thẻ (SRS)</strong>
          <p class="muted">Đưa từ vựng, kanji và mẫu ngữ pháp của bài vào hàng ôn tập cách quãng.</p>
          <button class="btn" type="button" onclick={toSrs}>{srsCount ? 'Cập nhật thẻ ôn' : 'Đưa vào thẻ ôn'}</button>
          {#if srsNote || srsCount}<p class="muted" role="status">{srsNote || `${srsCount} thẻ đang chờ ôn.`}</p>{/if}
        </section>
        <section class="card soft stack">
          <strong>Sau bài này</strong>
          <div class="row">
            <button class="btn soft" type="button" disabled={!prev} onclick={() => prev && onopen(prev)}>‹ Bài {prev?.order ?? ''}</button>
            <button class="btn" type="button" disabled={!next} onclick={() => next && onopen(next)}>Bài {next?.order ?? ''} ›</button>
          </div>
          <button class="link" type="button" onclick={reset}>Làm lại từ đầu</button>
        </section>
      </aside>
    </div>
  {/if}
</div>

<style>
  .stack { display: grid; gap: var(--space-3); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .back { justify-self: start; }
  h2 { margin: var(--space-1) 0 0; font-size: var(--text-xl); color: var(--accent-strong); }
  h3 { margin: var(--space-3) 0 var(--space-2); font-size: var(--text-lg); }
  .head { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); }
  .big { font-size: calc(2.2rem * var(--font-scale)); font-weight: 800; color: var(--accent-strong); }
  .big small { font-size: .5em; }
  progress { width: 100%; height: 12px; accent-color: var(--accent); }
  .muted { color: var(--text-muted); margin: 0; }
  .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: var(--space-2); }
  .step { text-align: left; display: grid; gap: 2px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); min-height: 44px; }
  .step.done { background: var(--success-soft); border-color: var(--success); color: var(--success); }
  .step .l { font-family: var(--font-jp); font-weight: 700; color: var(--accent-strong); }
  .step.done .l { color: var(--success); }
  .tabs { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .layout { display: grid; gap: var(--space-4); grid-template-columns: 1fr; align-items: start; }
  @media (min-width: 720px) { .layout { grid-template-columns: 1.6fr 1fr; } }
  .soft { background: var(--surface-2); }
  .tint { background: var(--butter-100); }
  :root[data-theme='dark'] .tint { background: #4a4126; }
  .tips { margin: 0; padding-left: 1.2rem; display: grid; gap: var(--space-2); }
  .rows, .kanji { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-2); }
  .rows li { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; padding: var(--space-2) 0; border-bottom: 1px dashed var(--border); }
  .no { color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .big-jp { font-size: var(--text-jp-reading); font-weight: 700; }
  .grow { flex: 1 1 8rem; }
  .src { flex-basis: 100%; padding-left: 2.4rem; }
  .kanji { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
  .kanji li { display: grid; justify-items: center; text-align: center; gap: 2px; background: var(--surface-2); }
  .k { font-size: 2.4rem; line-height: 1.3; }
  .pattern { font-size: var(--text-lg); }
  .ex { border-left: 4px solid var(--accent); padding-left: var(--space-3); font-size: var(--text-jp-reading); }
  .vi { display: block; font-family: var(--font-ui); font-size: var(--text-sm); line-height: 1.4; }
  .tr { display: grid; gap: var(--space-2); }
  .tr button { display: flex; gap: var(--space-3); text-align: left; padding: var(--space-2) var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); font-size: var(--text-jp-reading); min-height: 44px; }
  .who { font-family: var(--font-ui); font-weight: 800; color: var(--accent-strong); }
  textarea { min-height: 7rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); padding: var(--space-2); font: inherit; color: inherit; resize: vertical; }
  .mark { margin: var(--space-4) 0 0; }
  .video { display: flex; gap: var(--space-3); align-items: center; }
  .play { width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--info-soft); color: var(--info); font-size: 1.4rem; }
  .video p { margin: 0; }
  .link { background: none; border: 0; color: var(--text-muted); text-decoration: underline; justify-self: start; min-height: 44px; }
  .empty { background: var(--surface-2); }
  .toggle { display: flex; gap: var(--space-2); align-items: center; }
  input[type='checkbox'] { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); }
</style>
