<script lang="ts">
  import { dict, closePopup, popupBack, openWord, loadExamples, loadKanji, currentDb } from './state.svelte';
  import { addWordToSrs, cardIdFor, hasSrsCard, type AddWordInput } from '../srs/bridge';
  import { relatedWords } from './related';
  import { isKanji } from './kana';
  import { freqLabel, jlptLabel, posLabels } from './labels';
  import type { Example, KanjiEntry, Word } from './types';

  const word = $derived.by<Word | undefined>(() => {
    const id = dict.popup[dict.popup.length - 1];
    return id && dict.index ? dict.index.get(id) : undefined;
  });
  const related = $derived(word && dict.index ? relatedWords(dict.index, word) : undefined);
  const title = $derived(word ? (word.kanji[0]?.text ?? word.kana[0].text) : '');

  let examples = $state<Example[]>([]);
  let kanji = $state<KanjiEntry[]>([]);
  let closeBtn = $state<HTMLButtonElement>();

  $effect(() => {
    const w = word;
    examples = []; kanji = [];
    if (!w) return;
    let stale = false;
    loadExamples((w.ex ?? []).slice(0, 5)).then((r) => { if (!stale) examples = r; });
    loadKanji([...(w.kanji[0]?.text ?? '')].filter(isKanji)).then((r) => { if (!stale) kanji = r; });
    return () => { stale = true; };
  });
  $effect(() => { if (word) closeBtn?.focus(); });

  // "Add to SRS": the card comes from this entry; when the word was tapped in manga or a subtitle, the line becomes its example sentence.
  let inSrs = $state(false);
  let srsMsg = $state('');
  const cardKind = $derived(dict.context?.kind ?? 'dictionary');
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
    const ctx = dict.context;
    const input: AddWordInput = {
      wordId: w.id, word: spelling(w), reading: w.kana[0].text, meaning: gloss(w),
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

  const tags = $derived(word ? [
    word.jlpt ? { text: jlptLabel(word.jlpt), tone: 'pink' } : null,
    freqLabel(word.common, word.rank) ? { text: freqLabel(word.common, word.rank)!, tone: 'mint' } : null
  ].filter((t): t is { text: string; tone: string } => !!t) : []);

  const spelling = (w: Word) => w.kanji[0]?.text ?? w.kana[0].text;
  const gloss = (w: Word) => w.senses.flatMap((s) => s.gloss).slice(0, 3).join('; ');
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closePopup(); }
</script>

<svelte:window onkeydown={onKey} />

{#if word && related}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={closePopup}>
    <div class="sheet card" role="dialog" aria-modal="true" aria-label={`Từ điển: ${title}`} tabindex="-1" onclick={(e) => e.stopPropagation()}>
      <div class="top">
        {#if dict.popup.length > 1}<button class="btn soft" onclick={popupBack} aria-label="Quay lại">←</button>{/if}
        <button class="btn soft close" bind:this={closeBtn} onclick={closePopup} aria-label="Đóng">✕</button>
      </div>

      <h2 class="head jp" lang="ja">
        {#if word.kanji.length}<ruby>{title}<rt>{word.kana[0].text}</rt></ruby>{:else}{title}{/if}
      </h2>
      {#if word.kanji.length > 1 || word.kana.length > 1}
        <p class="alts jp muted" lang="ja">
          Cách viết / đọc khác: {[...word.kanji.slice(1).map((k) => k.text), ...word.kana.slice(1).map((k) => k.text)].join('、')}
        </p>
      {/if}
      <div class="chips">{#each tags as t}<span class="chip {t.tone}">{t.text}</span>{/each}</div>

      <ol class="senses">
        {#each word.senses as s}
          <li>
            <span class="pos">{posLabels(s.pos).join(' · ')}</span>
            <span class="gloss">{s.gloss.join('; ')}</span>
          </li>
        {/each}
      </ol>
      <p class="muted small">Nghĩa lấy từ JMdict (tiếng Anh).</p>
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
              <button class="chip rel jp" lang="ja" onclick={() => openWord(r.id)} title={gloss(r)}>
                {spelling(r)} <span class="muted small">{gloss(r)}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; background: rgb(0 0 0 / .4); display: grid; place-items: end center; z-index: 50; }
  .sheet { width: min(640px, 100%); max-height: 88dvh; overflow-y: auto; border-radius: var(--radius) var(--radius) 0 0; }
  @media (min-width: 700px) { .backdrop { place-items: center; } .sheet { border-radius: var(--radius); } }
  .top { display: flex; justify-content: space-between; }
  .close { margin-left: auto; }
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
  .kanji li { display: flex; gap: var(--space-3); align-items: center; }
  .big { font-size: 2rem; color: var(--accent-strong); min-width: 2.4rem; text-align: center; }
  .rel { border: 0; min-height: 44px; display: inline-flex; align-items: center; gap: .4rem; }
</style>
