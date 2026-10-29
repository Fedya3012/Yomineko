<script lang="ts">
  // Invisible live region. Call announce('Đã thêm vào thẻ ôn') after an action that changes nothing visible.
  let message = $state('');
  export function announce(text: string) { message = ''; queueMicrotask(() => (message = text)); }
</script>

<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</div>
