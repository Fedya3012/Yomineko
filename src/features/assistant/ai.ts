import { PHRASES, getPersona, STYLE_LABELS } from './personas';
import { getScenario } from './scenarios';
import type { AssistMode, AssistantSettings, ChatMessage, ProviderConfig, ProviderKind, RoleplayState } from './types';

export const PROVIDER_PRESETS: Record<string, ProviderConfig & { label: string }> = {
  ollama: { label: 'Máy tính của bạn (Ollama, miễn phí)', kind: 'openai-compatible', baseUrl: 'http://localhost:11434/v1', model: 'qwen3:1.7b' },
  anthropic: { label: 'Claude (cần khoá API)', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5' },
  openai: { label: 'Dịch vụ tương thích OpenAI (cần khoá API)', kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }
};

export const hostOf = (baseUrl: string): string => {
  try { return new URL(baseUrl).host; } catch { return ''; }
};

const MODE_TASK: Record<AssistMode, string> = {
  chat: 'Trò chuyện thân thiện, trả lời ngắn gọn. Mỗi câu tiếng Nhật kèm nghĩa tiếng Việt.',
  grammar: 'Giải thích ngữ pháp mà người học hỏi bằng tiếng Việt đơn giản, có 2 ví dụ tiếng Nhật kèm nghĩa.',
  correct: 'Sửa câu tiếng Nhật của người học: đưa câu đã sửa trước, rồi giải thích từng lỗi ngắn gọn bằng tiếng Việt. Nếu câu đúng thì khen.',
  roleplay: 'Nhập vai đối thoại tiếng Nhật theo tình huống. Chỉ đóng vai nhân vật còn lại, nói 1 đến 2 câu tiếng Nhật đơn giản đúng trình độ. Sau câu của người học, nhận xét rất ngắn bằng tiếng Việt (nếu có lỗi) rồi tiếp tục vai.'
};

/** The system prompt carries only persona + level + task. No learner data beyond that is ever included. */
export function buildSystemPrompt(s: AssistantSettings, mode: AssistMode, rp?: RoleplayState): string {
  const p = getPersona(s.personaId);
  const name = s.customName.trim() || p.name;
  const lines = [
    `Bạn là ${name}, trợ lý học tiếng Nhật trong ứng dụng Yomineko. Nhân vật: ${p.blurb}. Phong cách nói: ${STYLE_LABELS[s.style]}.`,
    `Mẫu giọng: "${PHRASES[s.style].cheer[0]}"`,
    `Người học trình độ ${s.level}; chỉ dùng ngữ pháp và từ vựng ở mức đó hoặc dễ hơn.`,
    'Luôn trả lời bằng tiếng Việt, câu tiếng Nhật kèm nghĩa. Luôn khích lệ, không chê bai.',
    `Nhiệm vụ: ${MODE_TASK[mode]}`
  ];
  const sc = rp && getScenario(rp.scenarioId);
  if (mode === 'roleplay' && sc) lines.push(`Tình huống: ${sc.title}, tại ${sc.place}.`);
  return lines.join('\n');
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function callAi(
  cfg: ProviderConfig, apiKey: string, system: string, messages: ChatMessage[],
  fetchFn: FetchLike = (u, i) => fetch(u, i), timeoutMs = 25000
): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const msgs = messages.map((m) => ({ role: m.role, content: m.text }));
  const base = cfg.baseUrl.replace(/\/+$/, '');
  try {
    const res = cfg.kind === 'anthropic'
      ? await fetchFn(`${base}/v1/messages`, {
          method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: cfg.model, max_tokens: 600, system, messages: msgs })
        })
      : await fetchFn(`${base}/chat/completions`, {
          method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify({ model: cfg.model, max_tokens: 600, messages: [{ role: 'system', content: system }, ...msgs] })
        });
    if (!res.ok) throw new Error(`Dịch vụ AI trả lỗi ${res.status}`);
    const json = await res.json();
    const text = cfg.kind === 'anthropic' ? json?.content?.[0]?.text : json?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new Error('AI trả về nội dung rỗng');
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

export const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
export type { ProviderKind };
