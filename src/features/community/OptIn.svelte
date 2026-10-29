<script lang="ts">
  // First screen. Nothing is created or shared until the learner presses a button here.
  import { Button, EmptyState } from '../../lib/ui';
  import './community.css';
  let { onenable, ondemo }: { onenable: (name: string) => void; ondemo: () => void } = $props();
  let name = $state('');
</script>

<EmptyState title="Học cùng bạn bè, hoàn toàn tuỳ bạn" body="Cộng đồng đang TẮT. Yomineko không gửi gì ra ngoài. Chỉ khi bạn bật lên, tạo nhóm và bấm xuất file thì số liệu mới được chia sẻ, và bạn tự chọn chia sẻ gì.">
  <div class="cm-stack" style="width: min(100%, 22rem)">
    <label class="cm-field">Tên hiển thị trong nhóm
      <input bind:value={name} maxlength="40" placeholder="Ví dụ: Mai" autocomplete="nickname" />
    </label>
    <Button onclick={() => onenable(name)}>Bật cộng đồng</Button>
    <Button variant="soft" onclick={ondemo}>Xem thử với dữ liệu mẫu</Button>
  </div>
</EmptyState>
