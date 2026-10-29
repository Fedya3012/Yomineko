<script lang="ts" generics="T extends string">
  // Pick one of a few options (theme, reading direction, grade...). Radio semantics for screen readers.
  let { value = $bindable(), options, label }: { value: T; options: [T, string][]; label: string } = $props();
  function onkey(e: KeyboardEvent) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = options.findIndex(([v]) => v === value);
    value = options[(i + dir + options.length) % options.length][0];
    queueMicrotask(() => (e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  }
</script>

<!-- Radio-group keyboard pattern: Tab enters once, arrow keys move and select (roving tabindex). -->
<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as [v, text]}
    <button type="button" role="radio" aria-checked={value === v} tabindex={value === v ? 0 : -1} onkeydown={onkey} class:on={value === v} onclick={() => (value = v)}>{text}</button>
  {/each}
</div>

<style>
  .seg { display: flex; gap: 4px; padding: 4px; background: var(--bg-sunken); border-radius: var(--radius-pill); border: 2px solid var(--border-strong); }
  button { flex: 1; min-height: 40px; border: 0; background: transparent; border-radius: var(--radius-pill); font-weight: 700; color: var(--text-muted); padding: 0 var(--space-3); }
  button.on { background: var(--surface); color: var(--accent-strong); box-shadow: var(--shadow); }
</style>
