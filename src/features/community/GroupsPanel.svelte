<script lang="ts">
  import { Button, EmptyState } from '../../lib/ui';
  import type { Group, Person, Profile, SharePrefs } from './types';
  import { describeShare } from './share';
  import './community.css';

  interface Props {
    profile: Profile;
    groups: Group[];
    people: Map<string, Person>;
    selected: string;
    hasDemo: boolean;
    message: { text: string; ok: boolean } | undefined;
    onselect: (id: string) => void;
    oncreate: (name: string) => void;
    onleave: (id: string) => void;
    onshare: (share: SharePrefs, name: string) => void;
    onexport: (groupIds: string[], mode: 'file' | 'copy') => void;
    onimport: (text: string) => void;
    onclearDemo: () => void;
    onwipe: () => void;
  }
  let { profile, groups, people, selected, hasDemo, message, onselect, oncreate, onleave, onshare, onexport, onimport, onclearDemo, onwipe }: Props = $props();

  let newName = $state('');
  let importText = $state('');
  // The form starts from the saved profile and is then edited locally.
  // svelte-ignore state_referenced_locally
  let displayName = $state(profile.name);
  // svelte-ignore state_referenced_locally
  let share = $state<SharePrefs>({ ...profile.share });
  const realGroups = $derived(groups.filter((g) => !g.demo));
  let picked = $state<string[]>([]);
  const chosen = $derived(picked.length ? picked.filter((id) => realGroups.some((g) => g.id === id)) : realGroups.map((g) => g.id));

  function toggle(id: string, on: boolean) {
    const base = picked.length ? picked : realGroups.map((g) => g.id);
    picked = on ? [...new Set([...base, id])] : base.filter((x) => x !== id);
  }
  async function readFile(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (f) importText = await f.text();
  }
  const lines = $derived(describeShare(share));
</script>

<div class="cm-stack">
  <section class="card" aria-labelledby="g-mine">
    <h2 class="cm-h" id="g-mine">Nhóm của bạn</h2>
    {#if groups.length === 0}
      <EmptyState title="Chưa có nhóm nào" body="Tạo nhóm rồi gửi file mời cho bạn bè, hoặc nhập file bạn bè gửi cho bạn ở bên dưới." />
    {:else}
      <ul class="cm-list">
        {#each groups as g (g.id)}
          <li class="card row" class:sel={g.id === selected}>
            <span class="cm-avatar" aria-hidden="true" lang="ja">組</span>
            <div class="grow">
              <strong>{g.name}</strong>
              <p class="cm-muted">{g.memberIds.filter((id) => id === profile.id || people.has(id)).length} thành viên{g.demo ? ' · dữ liệu mẫu' : ''}</p>
            </div>
            <Button variant={g.id === selected ? 'solid' : 'soft'} onclick={() => onselect(g.id)} aria-pressed={g.id === selected}>{g.id === selected ? 'Đang xem' : 'Xem'}</Button>
            {#if !g.demo}<Button variant="ghost" onclick={() => onleave(g.id)} aria-label={`Rời nhóm ${g.name}`}>Rời</Button>{/if}
          </li>
        {/each}
      </ul>
    {/if}
    <form class="cm-row" style="margin-top: var(--space-3)" onsubmit={(e) => { e.preventDefault(); oncreate(newName); newName = ''; }}>
      <label class="cm-field">Tạo nhóm mới
        <input bind:value={newName} maxlength="60" placeholder="Ví dụ: Nhóm N5 buổi tối" />
      </label>
      <Button type="submit" disabled={!newName.trim()}>Tạo nhóm</Button>
    </form>
    {#if hasDemo}<p><Button variant="ghost" onclick={onclearDemo}>Xoá dữ liệu mẫu</Button></p>{/if}
  </section>

  <section class="card" aria-labelledby="g-share">
    <h2 class="cm-h" id="g-share">Bạn muốn chia sẻ gì?</h2>
    <p class="cm-muted">Mặc định KHÔNG chia sẻ gì. Tick mục nào thì mục đó mới nằm trong file bạn xuất.</p>
    <label class="cm-field" style="margin-top: var(--space-2)">Tên hiển thị
      <input bind:value={displayName} maxlength="40" onchange={() => onshare(share, displayName)} />
    </label>
    {#each [['minutes', 'Số phút học mỗi ngày'], ['cards', 'Số thẻ đã ôn mỗi ngày'], ['words', 'Số mục mới học mỗi ngày'], ['streak', 'Chuỗi ngày học']] as [key, label]}
      <label class="cm-check">
        <input type="checkbox" checked={share[key as keyof SharePrefs]} onchange={(e) => { share = { ...share, [key]: e.currentTarget.checked }; onshare(share, displayName); }} />
        <span>{label}</span>
      </label>
    {/each}
    <div class="cm-note" role="note">
      <strong>File xuất sẽ chứa:</strong>
      <ul>{#each lines as l}<li>{l}</li>{/each}</ul>
    </div>
  </section>

  <section class="card" aria-labelledby="g-out">
    <h2 class="cm-h" id="g-out">Gửi cho bạn bè</h2>
    {#if realGroups.length === 0}
      <p class="cm-muted">Tạo một nhóm trước, rồi quay lại đây để xuất file.</p>
    {:else}
      <p class="cm-muted">Chọn nhóm cần gửi. Bạn bè nhận file xong bấm “Nhập” để vào nhóm và thấy số liệu của bạn.</p>
      {#each realGroups as g (g.id)}
        <label class="cm-check"><input type="checkbox" checked={chosen.includes(g.id)} onchange={(e) => toggle(g.id, e.currentTarget.checked)} /><span>{g.name}</span></label>
      {/each}
      <div class="cm-row">
        <Button onclick={() => onexport(chosen, 'file')} disabled={!chosen.length}>Tải file chia sẻ</Button>
        <Button variant="soft" onclick={() => onexport(chosen, 'copy')} disabled={!chosen.length}>Sao chép mã</Button>
      </div>
    {/if}
  </section>

  <section class="card" aria-labelledby="g-in">
    <h2 class="cm-h" id="g-in">Nhận từ bạn bè</h2>
    <p class="cm-muted">Chọn file bạn bè gửi, hoặc dán mã vào ô dưới.</p>
    <label class="cm-field">File chia sẻ (.json)
      <input type="file" accept=".json,application/json" onchange={readFile} />
    </label>
    <label class="cm-field" style="margin-top: var(--space-2)">Hoặc dán mã
      <textarea bind:value={importText} spellcheck="false" placeholder="Dán mã vào đây"></textarea>
    </label>
    <p><Button onclick={() => { onimport(importText); }} disabled={!importText.trim()}>Nhập</Button></p>
  </section>

  {#if message}
    <p class="cm-note" class:ok={message.ok} class:bad={!message.ok} role={message.ok ? 'status' : 'alert'}>{message.text}</p>
  {/if}

  <section class="card" aria-labelledby="g-wipe">
    <h2 class="cm-h" id="g-wipe">Tắt cộng đồng</h2>
    <p class="cm-muted">Xoá nhóm, thử thách, bảng tin và số liệu của bạn bè khỏi máy này. Tiến độ học của bạn không bị ảnh hưởng. File đã gửi đi thì bạn bè vẫn giữ.</p>
    <p><Button variant="ghost" onclick={onwipe}>Xoá dữ liệu cộng đồng</Button></p>
  </section>
</div>

<style>
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); box-shadow: var(--shadow-sm); }
  .row.sel { background: var(--accent-soft); }
  .grow { flex: 1 1 10rem; min-width: 0; }
  .grow p { margin: 0; }
</style>
