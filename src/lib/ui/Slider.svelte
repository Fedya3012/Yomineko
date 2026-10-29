<script lang="ts">
  // Labelled range input (font size, speed, volume). `format` makes the spoken value friendly: "125 phần trăm".
  let { value = $bindable(), min, max, step = 1, label, format = (v: number) => String(v) }:
    { value: number; min: number; max: number; step?: number; label: string; format?: (v: number) => string } = $props();
  const id = `sl-${Math.random().toString(36).slice(2, 8)}`;
</script>

<div class="sl">
  <label for={id}>{label}</label><output for={id}>{format(value)}</output>
  <input {id} type="range" {min} {max} {step} bind:value aria-valuetext={format(value)} />
</div>

<style>
  .sl { display: grid; grid-template-columns: 1fr auto; gap: var(--space-1) var(--space-3); align-items: center; }
  label { font-weight: 700; } output { font-variant-numeric: tabular-nums; color: var(--text-muted); }
  input { grid-column: 1 / -1; width: 100%; min-height: 44px; accent-color: var(--accent-gfx); }
</style>
