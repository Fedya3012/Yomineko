<script lang="ts">
  import { dict, loadExamples, loadKanji, loadJitendex, setMeaningSource, currentDb } from './state.svelte';
  import { Segmented } from '../../lib/ui';
  import { groupSenses, jitendexGloss, MEANING_SOURCES, visibleSources, type MeaningSource } from './jitendex';
  import { addWordToSrs, cardIdFor, hasSrsCard, type AddWordInput } from '../srs/bridge';
  import { relatedWords } from './related';
  import { isKanji } from './kana';
  import { freqLabel, jlptLabel, posLabels, tagLabel } from './labels';
  import type { WordContext } from './state.svelte';
  import type { Example, JitendexEntry, KanjiEntry, Word } from './types';

  let { wordId, context, onOpen }: { wordId: string; context?: WordContext; onOpen: (id: string) => void } = $props();

  const word = $derived(dict.index?.get(wordId));
  const related = $derived(word && dict.index ? relatedWords(dict.index, word) : undefined);
  const title = $derived(word ? (word.kanji[0]?.text ?? word.kana[0].text) : '');

  let examples = $state<Example[]>([]);
  let kanji = $state<KanjiEntry[]>([]);
  let jitendex = $state<JitendexEntry | undefined>();

  $effect(() => {
    const w = word;
    examples = []; kanji = []; jitendex = undefined;
    if (!w) return;
    let stale = false;
    loadJitendex(w.id).then((r) => { if (!stale) jitendex = r; });
    loadExamples((w.ex ?? []).slice(0, 5)).then((r) => { if (!stale) examples = r; });
    loadKanji([...(w.kanji[0]?.text ?? '')].filter(isKanji)).then((r) => { if (!stale) kanji = r; });
    return () => { stale = true; };
  });

  // "Add to SRS": the card comes from this entry; when the word was tapped in manga or a subtitle, the line becomes its example sentence.
  let inSrs = $state(false);
  let srsMsg = $state('');
  const cardKind = $derived(context?.kind ?? 'dictionary');
  $effect(() => {
    const w = word; const kind = cardKind;
    inSrs = false; srsMsg = '';
    const db = currentDb();
    if (!w || !db) return;
    let stale = false;
    hasSrsCard(db, cardIdFor(kind, w.id)).then((r) => { if (!stale) inSrs = r; });
    return () => { stale = true; };
  });
  async function addToSrs() {
    const w = word; const db = currentDb();
    if (!w || !db) return;
    const ctx = context;
    const input: AddWordInput = {
      wordId: w.id, word: spelling(w), reading: w.kana[0].text, meaning: meaning(w),
      sentence: ctx?.sentence, blank: ctx?.surface, kind: ctx?.kind ?? 'dictionary', origin: ctx?.origin
    };
    try {
      const added = await addWordToSrs(db, input);
      inSrs = true;
      srsMsg = added ? `Đã thêm “${input.word}” vào thẻ ôn.` : 'Từ này đã có trong thẻ ôn rồi.';
    } catch (e) {
      srsMsg = 'Chưa thêm được: ' + (e instanceof Error ? e.message : String(e));
    }
  }

  const shown = $derived(visibleSources(dict.source, jitendex));

  const tags = $derived(word ? [
    word.jlpt ? { text: jlptLabel(word.jlpt), tone: 'pink' } : null,
    freqLabel(word.common, word.rank) ? { text: freqLabel(word.common, word.rank)!, tone: 'mint' } : null
  ].filter((t): t is { text: string; tone: string } => !!t) : []);

  const spelling = (w: Word) => w.kanji[0]?.text ?? w.kana[0].text;
  const gloss = (w: Word) => w.senses.flatMap((s) => s.gloss).slice(0, 3).join('; ');
  // Cards and chips use the meaning of the source the learner picked (JMdict when Jitendex has nothing).
  const meaning = (w: Word) => (shown.jitendex && !shown.jmdict && jitendex ? jitendexGloss(jitendex) : gloss(w));
</script>

{#if word && related}
  <h2 class="head jp" lang="ja">
    {#if word.kanji.length}<ruby>{title}<rt>{word.kana[0].text}</rt></ruby>{:else}{title}{/if}
  </h2>
  {#if word.kanji.length > 1 || word.kana.length > 1}
    <p class="alts jp muted" lang="ja">
      Cách viết / đọc khác: {[...word.kanji.slice(1).map((k) => k.text), ...word.kana.slice(1).map((k) => k.text)].join('、')}
    </p>
  {/if}
  <div class="chips">{#each tags as t}<span class="chip {t.tone}">{t.text}</span>{/each}</div>

  {#if dict.hasJitendex}
    <div class="source"><Segmented bind:value={() => dict.source, (v: MeaningSource) => void setMeaningSource(v)} options={MEANING_SOURCES} label="Nguồn nghĩa" /></div>
  {/if}

  {#if shown.jmdict}
    {#if shown.jitendex}<h3>JMdict</h3>{/if}
    <ol class="senses">
      {#each word.senses as s}
        <li>
          <span class="pos">{posLabels(s.pos).join(' · ')}</span>
          <span class="gloss">{s.gloss.join('; ')}</span>
        </li>
      {/each}
    </ol>
    <p class="muted small">Nghĩa lấy từ JMdict (tiếng Anh).</p>
  {/if}
  {#if shown.jitendex && jitendex}
    {#if shown.jmdict}<h3>Jitendex</h3>{/if}
    {#each groupSenses(jitendex.senses) as g}
      <p class="pos group">{posLabels(g.pos).join(' · ')}</p>
      <ol class="senses jx">
        {#each g.senses as s}
          <li>
            {#if s.tags?.length}<span class="tagline">{#each s.tags as t}<span class="chip">{tagLabel(t)}</span>{/each}</span>{/if}
            <span class="gloss">{s.gloss.join('; ')}</span>
            {#if s.note?.length}<span class="muted small"> — {s.note.join('; ')}</span>{/if}
            {#if s.lang}<span class="muted small"> · {s.lang}</span>{/if}
            {#if s.ex}<span class="jx-ex"><span class="jp" lang="ja">{s.ex.ja}</span><span class="muted">{s.ex.en}</span></span>{/if}
          </li>
        {/each}
      </ol>
    {/each}
    <p class="muted small">Nghĩa lấy từ Jitendex (CC BY-SA 4.0, dựa trên JMdict).</p>
  {:else if dict.hasJitendex && dict.source !== 'jmdict'}
    <p class="muted small">Jitendex chưa có từ này, đang hiện nghĩa JMdict.</p>
  {/if}
  <div class="srs-row">
    <button class="btn" onclick={addToSrs} disabled={inSrs}>{inSrs ? '✓ Đã có trong thẻ ôn' : '+ Thêm vào thẻ ôn (SRS)'}</button>
    {#if srsMsg}<span role="status" class="muted small">{srsMsg}</span>{/if}
  </div>

  {#if examples.length}
    <h3>Câu ví dụ</h3>
    <ul class="plain">
      {#each examples as ex (ex.id)}
        <li><span class="jp" lang="ja">{ex.ja}</span><br /><span class="muted">{ex.en}</span></li>
      {/each}
    </ul>
  {/if}

  {#if kanji.length}
    <h3>Chữ Hán</h3>
    <ul class="plain kanji">
      {#each kanji as k (k.id)}
        <li>
          <span class="big jp" lang="ja">{k.id}</span>
          <span>
            <span class="jp" lang="ja">{[...k.on, ...k.kun].join('、')}</span><br />
            {k.meanings.slice(0, 4).join(', ')}
            <span class="muted small">{k.strokes ? ` · ${k.strokes} nét` : ''}{k.grade && k.grade <= 6 ? ` · lớp ${k.grade}` : ''}{k.freq ? ` · #${k.freq}` : ''}</span>
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  {#each [['Xem thêm', related.seeAlso], ['Từ trái nghĩa', related.antonyms], ['Cùng chữ Hán', related.sameKanji]] as [label, list] (label)}
    {#if (list as Word[]).length}
      <h3>{label}</h3>
      <div class="chips">
        {#each list as Word[] as r (r.id)}
          <button class="chip rel jp" lang="ja" onclick={() => onOpen(r.id)} title={gloss(r)}>
            {spelling(r)} <span class="muted small">{gloss(r)}</span>
          </button>
        {/each}
      </div>
    {/if}
  {/each}
{/if}

<style>
  .head { margin: 0; font-size: 2.2rem; color: var(--accent-strong); }
  h3 { margin: var(--space-4) 0 var(--space-1); font-size: var(--text-md); }
  .alts, .muted { color: var(--text-muted); margin: 0; }
  .small { font-size: var(--text-sm); }
  .chips { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .4rem; }
  .senses { padding-left: 1.4rem; margin: var(--space-3) 0 var(--space-1); }
  .senses li { margin-bottom: .35rem; }
  .pos { font-size: var(--text-sm); color: var(--text-muted); margin-right: .4rem; }
  .plain { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--space-2); }
  .srs-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }
  .source { margin-top: var(--space-3); }
  .group { margin: var(--space-3) 0 0; }
  .jx { margin-top: .2rem; }
  .tagline { display: inline-flex; flex-wrap: wrap; gap: .25rem; margin-right: .4rem; }
  .jx-ex { display: grid; margin: .2rem 0 .3rem; font-size: var(--text-sm); }
  .kanji li { display: flex; gap: var(--space-3); align-items: center; }
  .big { font-size: 2rem; color: var(--accent-strong); min-width: 2.4rem; text-align: center; }
  .rel { border: 0; min-height: 44px; display: inline-flex; align-items: center; gap: .4rem; }
</style>
