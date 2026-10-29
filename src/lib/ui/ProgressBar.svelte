<script lang="ts">
  let { value, label = '', tone = 'accent' }: { value: number; label?: string; tone?: 'accent' | 'success' | 'info' } = $props();
  const v = $derived(Math.min(1, Math.max(0, value)));
</script>

<div class="bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(v * 100)}>
  <span style="width:{v * 100}%; background:var({tone === 'accent' ? '--accent-gfx' : '--' + tone})"></span>
</div>

<style>
  .bar { height: 10px; border-radius: var(--radius-pill); background: var(--bg-sunken); border: 1px solid var(--border-strong); overflow: hidden; }
  span { display: block; height: 100%; border-radius: inherit; transition: width .3s; }
</style>
