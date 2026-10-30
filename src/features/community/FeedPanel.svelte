<script lang="ts">
  import { Button, EmptyState } from '../../lib/ui';
  import type { Post, PostKind } from './types';
  import './community.css';

  let { posts, myId, onpost, onshareStreak, onshareProgress, onshareWords }: {
    posts: Post[]; myId: string;
    onpost: (text: string) => void; onshareStreak: () => void; onshareProgress: () => void; onshareWords: () => void;
  } = $props();

  let text = $state('');
  const kindChip: Record<PostKind, [string, string]> = {
    streak: ['butter', 'Chuỗi ngày'], progress: ['mint', 'Tiến độ'], words: ['sky', 'Từ mới'], text: ['pink', 'Tin nhắn']
  };
  const when = (at: number) => new Date(at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
</script>

<div class="cm-stack">
  <section class="card" aria-labelledby="f-new">
    <h2 class="cm-h" id="f-new">Chia sẻ với nhóm</h2>
    <div class="cm-row">
      <Button variant="soft" onclick={onshareStreak}>Chuỗi ngày của tôi</Button>
      <Button variant="soft" onclick={onshareProgress}>Tiến độ hôm nay</Button>
      <Button variant="soft" onclick={onshareWords}>Từ mới tuần này</Button>
    </div>
    <form class="cm-row" style="margin-top: var(--space-3)" onsubmit={(e) => { e.preventDefault(); onpost(text); text = ''; }}>
      <label class="cm-field">Viết gì đó
        <input bind:value={text} maxlength="280" placeholder="Hôm nay mình học được…" />
      </label>
      <Button type="submit" disabled={!text.trim()}>Đăng</Button>
    </form>
    <p class="cm-muted">Bài đăng nằm trên máy bạn. Bạn bè chỉ thấy khi bạn xuất file nhóm và họ nhập vào.</p>
  </section>

  {#if posts.length === 0}
    <EmptyState title="Bảng tin còn trống" body="Chia sẻ chuỗi ngày, tiến độ hoặc vài từ mới để mở đầu cuộc trò chuyện." />
  {:else}
    <ul class="cm-list" aria-label="Bảng tin">
      {#each posts as p (p.id)}
        <li class="card post">
          <span class="cm-avatar" aria-hidden="true">{p.authorName.slice(0, 1).toUpperCase()}</span>
          <div class="body">
            <div class="cm-row"><strong>{p.authorName}</strong>{#if p.authorId === myId}<span class="chip pink">Bạn</span>{/if}
              <span class="chip {kindChip[p.kind][0]}">{kindChip[p.kind][1]}</span>
              <span class="cm-muted">{when(p.at)}</span></div>
            {#if p.text}<p>{p.text}</p>{/if}
            {#if p.kind === 'streak' && p.streak !== undefined}<p class="big">{p.streak} <small>ngày liên tiếp</small></p>{/if}
            {#if p.words?.length}<p class="words" lang="ja">{#each p.words as w}<span class="chip sky">{w}</span> {/each}</p>{/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .post { display: flex; gap: var(--space-3); align-items: flex-start; box-shadow: var(--shadow-sm); }
  .body { flex: 1; min-width: 0; }
  .body p { margin: var(--space-1) 0 0; }
  .big { font-size: var(--text-xl); font-weight: 800; color: var(--accent-strong); }
  .big small { font-size: var(--text-sm); font-weight: 400; color: var(--text-muted); }
  .words { display: flex; flex-wrap: wrap; gap: var(--space-1); }
</style>
