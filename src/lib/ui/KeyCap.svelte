<script lang="ts">
  // One keyboard key, shown on the keybind page and in hints ("Space", "←", "J").
  let { k }: { k: string } = $props();
</script>

<kbd>{k}</kbd>

<style>
  kbd { display: inline-grid; place-items: center; min-width: 2rem; height: 2rem; padding: 0 .55rem; border-radius: var(--radius-sm);
    background: var(--surface); border: 2px solid var(--border-strong); border-bottom-width: 4px; font: 700 var(--text-sm) var(--font-ui); color: var(--text); }
</style>
