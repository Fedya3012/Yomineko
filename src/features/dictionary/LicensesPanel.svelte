<script lang="ts">
  import { DATA_LICENSES, SHARE_ALIKE_NOTE } from './licenses';
</script>

<details>
  <summary>Giấy phép & ghi công dữ liệu</summary>
  <p class="muted">Yomineko chỉ lưu dữ liệu có giấy phép mở, liệt kê đầy đủ dưới đây.</p>
  <ul>
    {#each DATA_LICENSES as l (l.id)}
      <li>
        <strong>{l.name}</strong> — {l.by}<br />
        <a href={l.url} target="_blank" rel="noopener noreferrer">Trang chủ</a> ·
        <a href={l.licenseUrl} target="_blank" rel="noopener noreferrer">{l.license}</a><br />
        <span class="muted">{l.note}</span>
      </li>
    {/each}
  </ul>
  <p class="muted">{SHARE_ALIKE_NOTE}</p>
</details>

<style>
  summary { cursor: pointer; font-weight: 700; min-height: 44px; display: flex; align-items: center; }
  ul { padding-left: 1.2rem; display: grid; gap: var(--space-2); }
  li a { display: inline-block; padding-block: .6rem; }
  .muted { color: var(--text-muted); }
</style>
