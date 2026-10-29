<script lang="ts">
  // Japanese text with optional furigana. `parts`: [base, reading?]. Furigana visibility follows the global toggle
  // (html[data-furigana]), so this component never needs to know the setting. `vertical` flows right-to-left.
  let { parts, vertical = false, size = 'reading' }: { parts: [string, string?][]; vertical?: boolean; size?: 'reading' | 'big' } = $props();
</script>

<span lang="ja" class="jp t-{size}" class:vertical>{#each parts as [base, rt]}{#if rt}<ruby>{base}<rt>{rt}</rt></ruby>{:else}{base}{/if}{/each}</span>

<style>
  .t-reading { font-size: var(--text-jp-reading); }
  .t-big { font-size: calc(3rem * var(--font-scale)); line-height: 1.5; }
</style>
