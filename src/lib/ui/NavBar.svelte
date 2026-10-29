<script lang="ts">
  // One navigation for all screens: bottom tab bar on phones, side rail on wide windows (CSS only).
  export interface NavItem { id: string; label: string; icon: string }
  let { items, current = $bindable(), onselect }: { items: NavItem[]; current: string; onselect?: (id: string) => void } = $props();
  function pick(id: string) { current = id; onselect?.(id); }
</script>

<nav aria-label="Chính">
  {#each items as it}
    <button type="button" aria-current={current === it.id ? 'page' : undefined} onclick={() => pick(it.id)}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d={it.icon} /></svg>
      <span>{it.label}</span>
    </button>
  {/each}
</nav>

<style>
  nav { display: flex; justify-content: space-around; gap: var(--space-1); padding: var(--space-2) var(--space-3); background: var(--surface); border-top: 1px solid var(--border); }
  button { flex: 1; display: grid; justify-items: center; gap: 2px; min-height: 52px; border: 0; border-radius: var(--radius); background: transparent; color: var(--text-muted); font-size: var(--text-sm); font-weight: 700; }
  svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
  button[aria-current='page'] { background: var(--accent-soft); color: var(--accent-strong); }
  @media (min-width: 900px) {
    nav { flex-direction: column; justify-content: flex-start; width: 96px; border-top: 0; border-right: 1px solid var(--border); padding: var(--space-4) var(--space-2); }
    button { flex: none; }
  }
</style>
