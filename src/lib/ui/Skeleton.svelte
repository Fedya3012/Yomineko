<script lang="ts">
  // Loading placeholder. Announced once as "Đang tải" (not every bar); shimmer is switched off for reduced motion by base.css.
  let { lines = 3, label = 'Đang tải' }: { lines?: number; label?: string } = $props();
</script>

<div class="sk" role="status" aria-busy="true" aria-label={label}>
  {#each Array(lines) as _, i}<span style="width:{i === lines - 1 ? 60 : 100}%"></span>{/each}
</div>

<style>
  .sk { display: grid; gap: var(--space-2); }
  span { height: 1rem; border-radius: var(--radius-pill); background: linear-gradient(90deg, var(--bg-sunken), var(--surface-2), var(--bg-sunken)); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; }
  @keyframes shimmer { to { background-position: -200% 0; } }
</style>
