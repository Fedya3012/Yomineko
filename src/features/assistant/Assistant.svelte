<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { DB } from '../../lib/db';
  import Badge from '../../lib/Badge.svelte';
  import { PERSONAS, STYLE_LABELS, getPersona, PHRASES } from './personas';
  import { SCENARIOS } from './scenarios';
  import { SIMPLE_GRADING_LABEL } from './grade';
  import { PROVIDER_PRESETS, hostOf, isLocalHost } from './ai';
  import { grantConsent, hasConsent, respond, startRoleplay } from './assistant';
  import { DEFAULT_ASSISTANT, clearAssistantData, loadAssistant, saveApiKey, saveAssistantSettings, saveHistory } from './store';
  import ModelPicker from '../models/ModelPicker.svelte';
  import { buildRoleplayReport, type SessionReport, type TurnResult } from './report';
  import type { AssistMode, AssistantSettings, ChatMessage, Level, ProviderConfig, RoleplayState, Style } from './types';

  let { db, onSessionEnd }: { db: DB; onSessionEnd?: (r: SessionReport) => unknown } = $props();

  let settings = $state<AssistantSettings>({ ...DEFAULT_ASSISTANT });
  let apiKey = $state('');
  let messages = $state<ChatMessage[]>([]);
  let mode = $state<AssistMode>('chat');
  let roleplay = $state<RoleplayState | undefined>();
  let input = $state('');
  let busy = $state(false);
  let notice = $state('');
  let tab = $state<'chat' | 'settings'>('chat');
  let rpResults: TurnResult[] = [];
  let rpStart = 0;
  let log = $state<HTMLElement>();
  let ready = false;

  const persona = $derived(getPersona(settings.personaId));
  const name = $derived(settings.customName.trim() || persona.name);
  const host = $derived(hostOf(settings.provider.baseUrl));
  const consented = $derived(hasConsent(settings));
  const modes: [AssistMode, string][] = [['chat', 'Trò chuyện'], ['grammar', 'Giải thích ngữ pháp'], ['correct', 'Sửa câu'], ['roleplay', 'Nhập vai']];
  const levels: Level[] = ['N5', 'N4', 'N3', 'N2', 'N1'];

  onMount(async () => {
    const s = await loadAssistant(db);
    settings = s.settings; apiKey = s.apiKey; messages = s.history;
    ready = true;
    if (messages.length === 0) push({ role: 'assistant', text: pickGreeting(), source: 'offline' });
  });

  // Save settings whenever they change (after the first load).
  $effect(() => { const s = $state.snapshot(settings); if (ready) saveAssistantSettings(db, s); });

  const pickGreeting = () => PHRASES[settings.style].greet[0];

  async function push(m: ChatMessage) {
    messages.push(m);
    await saveHistory(db, $state.snapshot(messages));
    await tick();
    log?.scrollTo({ top: log.scrollHeight });
  }

  async function send(text = input) {
    text = text.trim();
    if (!text || busy) return;
    input = ''; busy = true; notice = '';
    const history = $state.snapshot(messages);
    await push({ role: 'user', text });
    const r = await respond({ mode, text, history, settings: $state.snapshot(settings), apiKey, roleplay: $state.snapshot(roleplay) });
    notice = r.notice ?? '';
    if (r.roleplay) roleplay = r.roleplay;
    if (r.judged) rpResults.push(r.judged);
    await push({ role: 'assistant', text: r.text, source: r.source });
    busy = false;
    if (roleplay?.done) finishRoleplay();
  }

  async function beginRoleplay(id: string) {
    const r = startRoleplay(id);
    mode = 'roleplay'; roleplay = r.state; notice = '';
    rpResults = []; rpStart = Date.now();
    await push({ role: 'assistant', text: r.text, source: 'offline' });
  }

  // Tell the Progress feature (if wired) that a speaking session ended. Nothing leaves the device.
  function finishRoleplay() {
    const rep = roleplay && buildRoleplayReport(roleplay.scenarioId, rpResults, rpStart, Date.now());
    if (rep) onSessionEnd?.(rep);
    rpResults = [];
  }

  function choosePreset(key: string) {
    const { label: _l, ...p } = PROVIDER_PRESETS[key];
    settings.provider = p;
    settings.consent = undefined; // a new destination always needs a fresh opt-in
  }

  function pickModel(p: ProviderConfig) {
    settings.provider = p;
    if (hostOf(p.baseUrl) !== settings.consent?.host) settings.consent = undefined;
  }

  function setBaseUrl(v: string) {
    settings.provider.baseUrl = v;
    if (hostOf(v) !== settings.consent?.host) settings.consent = undefined;
  }

  function toggleConsent(on: boolean) {
    if (on) settings = grantConsent(settings);
    else settings.consent = undefined;
  }

  async function wipe() {
    await clearAssistantData(db);
    settings = { ...DEFAULT_ASSISTANT }; apiKey = ''; messages = []; roleplay = undefined;
    push({ role: 'assistant', text: pickGreeting(), source: 'offline' });
  }
</script>

<section class="card assistant" aria-label="Trợ lý học tiếng Nhật">
  <header class="head">
    <Badge tone={persona.tone} size={56}><span class="glyph" aria-hidden="true">{persona.glyph}</span></Badge>
    <div>
      <h2>{name}</h2>
      <span class="chip" class:mint={consented && settings.useAi} class:butter={!settings.useAi}>{settings.useAi && consented ? 'AI đang bật' : 'Chế độ offline'}</span>
    </div>
    <div class="tabs" role="tablist">
      <button class="btn" class:soft={tab !== 'chat'} role="tab" aria-selected={tab === 'chat'} onclick={() => (tab = 'chat')}>Trò chuyện</button>
      <button class="btn" class:soft={tab !== 'settings'} role="tab" aria-selected={tab === 'settings'} onclick={() => (tab = 'settings')}>Cài đặt</button>
    </div>
  </header>

  {#if tab === 'chat'}
    <div class="row" role="radiogroup" aria-label="Chế độ">
      {#each modes as [m, label]}
        <button class="btn" class:soft={mode !== m} role="radio" aria-checked={mode === m} onclick={() => (mode = m)}>{label}</button>
      {/each}
    </div>

    {#if mode === 'roleplay'}
      <div class="row" aria-label="Chọn tình huống">
        {#each SCENARIOS as sc}
          <button class="chip sky" onclick={() => beginRoleplay(sc.id)}>{sc.title} ({sc.level})</button>
        {/each}
      </div>
      {#if !roleplay}<p class="muted">Chọn một tình huống để bắt đầu luyện nói.</p>{/if}
      {#if !(settings.useAi && consented)}<p class="muted"><span class="chip butter">{SIMPLE_GRADING_LABEL}</span> Ở chế độ offline, app chỉ so câu bạn nói với câu mẫu. Bật AI để được nhận xét kỹ hơn.</p>{/if}
    {/if}

    <div class="log" bind:this={log} role="log" aria-live="polite">
      {#each messages as m}
        <div class="bubble" class:me={m.role === 'user'} lang="ja">{m.text}</div>
      {/each}
      {#if busy}<div class="bubble">…</div>{/if}
    </div>
    {#if notice}<p class="muted" role="status">{notice}</p>{/if}

    <form onsubmit={(e) => { e.preventDefault(); send(); }}>
      <input bind:value={input} lang="ja" placeholder={mode === 'correct' ? 'Gõ câu tiếng Nhật cần sửa…' : mode === 'grammar' ? 'Ví dụ: は, ます, て形…' : 'Nhập tin nhắn…'} aria-label="Tin nhắn" />
      <button class="btn" disabled={busy || (mode === 'roleplay' && (!roleplay || roleplay.done))}>Gửi</button>
    </form>
  {:else}
    <h3>Nhân vật trợ lý</h3>
    <div class="grid">
      {#each PERSONAS as p}
        <button class="btn pick" class:soft={settings.personaId !== p.id} aria-pressed={settings.personaId === p.id}
          onclick={() => { settings.personaId = p.id; settings.style = p.defaultStyle; }}>
          <span aria-hidden="true">{p.glyph}</span> {p.name}
          <small>{p.kind === 'anime' ? 'Nhân vật anime' : 'Thú cưng'}</small>
        </button>
      {/each}
    </div>
    <label>Đặt tên riêng (tuỳ chọn) <input bind:value={settings.customName} maxlength="20" placeholder={persona.name} /></label>
    <label>Tính cách
      <select bind:value={settings.style}>
        {#each Object.entries(STYLE_LABELS) as [k, v]}<option value={k as Style}>{v}</option>{/each}
      </select>
    </label>
    <label>Trình độ của bạn
      <select bind:value={settings.level}>{#each levels as l}<option value={l}>{l}</option>{/each}</select>
    </label>

    <h3>AI (tuỳ chọn)</h3>
    <p class="muted">Mặc định AI tắt. Không có AI, trợ lý vẫn giúp được bằng nội dung có sẵn trên máy, không cần mạng.</p>
    <label><input type="checkbox" bind:checked={settings.useAi} /> Dùng AI để trả lời thông minh hơn</label>
    {#if settings.useAi}
      <h3>Chọn model AI</h3>
      <ModelPicker provider={settings.provider} ramGb={settings.deviceRamGb} onSelect={pickModel} onRam={(gb) => (settings.deviceRamGb = gb)} />
      {#if settings.provider.kind !== 'webllm' && settings.provider.kind !== 'llamacpp'}
      <h3>Nâng cao: dịch vụ khác</h3>
      <label>Dịch vụ
        <select onchange={(e) => choosePreset(e.currentTarget.value)}>
          {#each Object.entries(PROVIDER_PRESETS) as [k, p]}
            <option value={k} selected={p.baseUrl === settings.provider.baseUrl}>{p.label}</option>
          {/each}
        </select>
      </label>
      <label>Địa chỉ <input value={settings.provider.baseUrl} oninput={(e) => setBaseUrl(e.currentTarget.value)} /></label>
      <label>Tên mô hình <input bind:value={settings.provider.model} /></label>
      <label>Khoá API {isLocalHost(host) ? '(không cần với máy của bạn)' : ''}
        <input type="password" autocomplete="off" bind:value={apiKey} onchange={() => saveApiKey(db, apiKey)} />
      </label>
      <div class="consent">
        <label>
          <input type="checkbox" checked={consented} onchange={(e) => toggleConsent(e.currentTarget.checked)} />
          Tôi đồng ý gửi <strong>tin nhắn đang chat</strong> (tối đa 8 tin gần nhất), trình độ và tên nhân vật tới <strong>{host || '(địa chỉ chưa hợp lệ)'}</strong>.
          {#if isLocalHost(host)}Địa chỉ này nằm ngay trên máy bạn.{/if}
        </label>
        <p class="muted">Không bao giờ gửi: thẻ SRS, tiến độ, thư viện manga/anime, khoá API của bạn cho bên thứ ba. Chưa tích ô này thì không có gì rời khỏi máy.</p>
      </div>
      {/if}
    {/if}
    <button class="btn soft" onclick={wipe}>Xoá hết dữ liệu trợ lý (chat, khoá API, đồng ý)</button>
  {/if}
</section>

<style>
  .assistant { display: grid; gap: var(--space-3); }
  .head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); }
  .head h2 { margin: 0; font-size: var(--text-lg); }
  .tabs { margin-left: auto; display: flex; gap: var(--space-2); }
  .glyph { font-size: 1.6rem; line-height: 1; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .muted { color: var(--text-muted); margin: 0; font-size: var(--text-sm); }
  .log { display: grid; gap: var(--space-2); max-height: 22rem; overflow-y: auto; padding: var(--space-2); background: var(--bg-sunken); border-radius: 16px; align-content: start; }
  .bubble { white-space: pre-wrap; padding: var(--space-2) var(--space-3); background: var(--surface); border: 1px solid var(--border); border-radius: 16px 16px 16px 4px; max-width: 90%; justify-self: start; }
  .bubble.me { justify-self: end; background: var(--accent-soft); border-radius: 16px 16px 4px 16px; }
  form { display: flex; gap: var(--space-2); }
  input:not([type='checkbox']), select { width: 100%; min-height: 44px; padding: 0 var(--space-3); border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
  form input { flex: 1; }
  label { display: grid; gap: 4px; }
  label:has(> input[type='checkbox']) { display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: var(--space-2); }
  .pick { display: grid; justify-items: start; text-align: left; }
  .pick small { opacity: 0.75; }
  .consent { background: var(--butter-100); color: var(--text); padding: var(--space-3); border-radius: 16px; display: grid; gap: var(--space-2); }
  h3 { margin: var(--space-2) 0 0; font-size: var(--text-md); }
</style>
