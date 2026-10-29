<script lang="ts">
  import { describeSource, SOURCE_LABELS } from './logic';
  import type { Source } from './types';

  let { source }: { source: Source } = $props();
  const tone = { textbook: 'pink', anime: 'sky', music: 'butter', manga: 'mint', dictionary: 'sky', user: 'pink' } as const;
</script>

<span class="chip {tone[source.type]}" title={describeSource(source)}>
  {SOURCE_LABELS[source.type]}{#if source.title} · {source.title}{/if}{#if source.location} · {source.location}{/if}
</span>
{#if source.note}<span class="note">{source.note}</span>{/if}

<style>
  .note { color: var(--text-muted); font-size: var(--text-sm); }
</style>
