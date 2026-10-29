<script lang="ts">
  // Switch with a text label. Whole row is clickable (44px tall) so it is easy to hit on a phone.
  let { checked = $bindable(false), label, hint = '' }: { checked?: boolean; label: string; hint?: string } = $props();
</script>

<label class="row">
  <span class="text"><strong>{label}</strong>{#if hint}<small>{hint}</small>{/if}</span>
  <input type="checkbox" role="switch" bind:checked />
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
</label>

<style>
  .row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); min-height: 44px; padding: var(--space-2) 0; cursor: pointer; }
  .text { display: grid; min-width: 0; }
  small { color: var(--text-muted); font-size: var(--text-sm); }
  input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .track { flex: none; width: 52px; height: 30px; border-radius: var(--radius-pill); background: var(--bg-sunken); border: 2px solid var(--border-strong); position: relative; transition: background .2s; }
  .thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--text); transition: transform .2s, background .2s; }
  input:checked + .track { background: var(--accent-soft); border-color: var(--accent-gfx); }
  input:checked + .track .thumb { transform: translateX(22px); background: var(--accent-gfx); }
  input:focus-visible + .track { box-shadow: var(--focus); }
</style>
