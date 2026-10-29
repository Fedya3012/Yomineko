<script lang="ts">
  // First focusable element on every screen: lets keyboard users jump past the navigation.
  let { target = '#main' }: { target?: string } = $props();
</script>

<a class="skip-link" href={target}>Bỏ qua tới nội dung chính</a>
