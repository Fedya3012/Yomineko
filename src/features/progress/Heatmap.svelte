<script lang="ts">
  import type { HeatCell } from './stats';
  let { weeks }: { weeks: (HeatCell | null)[][] } = $props();
</script>

<div class="heat" role="img" aria-label="Bản đồ nhiệt hoạt động học theo ngày">
  {#each weeks as col}
    <div class="col">
      {#each col as cell}
        {#if cell}
          <span class="cell l{cell.level}" title="{cell.date}: {cell.minutes} phút"></span>
        {:else}
          <span class="cell empty"></span>
        {/if}
      {/each}
    </div>
  {/each}
</div>
<p class="legend muted">Ít <span class="cell l0"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span><span class="cell l4"></span> Nhiều</p>

<style>
  .heat { display: flex; gap: 3px; overflow-x: auto; padding-bottom: var(--space-1); }
  .col { display: grid; grid-template-rows: repeat(7, 1fr); gap: 3px; }
  .cell { width: 14px; height: 14px; border-radius: 4px; display: inline-block; background: var(--bg-sunken); border: 1px solid var(--border); }
  .cell.empty { visibility: hidden; }
  .l1 { background: color-mix(in srgb, var(--accent) 25%, var(--surface)); }
  .l2 { background: color-mix(in srgb, var(--accent) 50%, var(--surface)); }
  .l3 { background: color-mix(in srgb, var(--accent) 75%, var(--surface)); }
  .l4 { background: var(--accent-strong); }
  .legend { display: flex; align-items: center; gap: 3px; font-size: var(--text-sm); margin: var(--space-2) 0 0; }
  .muted { color: var(--text-muted); }
</style>
