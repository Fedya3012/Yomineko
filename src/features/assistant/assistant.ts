import { callAi, buildSystemPrompt, hostOf, isLocalHost, type FetchLike } from './ai';
import { offlineChat, offlineCorrect, offlineGrammar, offlineRoleplay, roleplayOpening } from './offline';
import type { AssistMode, AssistantSettings, ChatMessage, Consent, RoleplayState } from './types';

/** Only the last few turns are ever sent, to keep what leaves the device to the minimum. */
export const MAX_SENT_TURNS = 8;

export interface Reply { text: string; source: 'ai' | 'offline'; notice?: string; roleplay?: RoleplayState; judged?: { step: number; ok: boolean } }

export interface Deps { fetch?: FetchLike; online?: () => boolean; rand?: () => number }

/** True only if the user explicitly opted in for the exact host that is currently configured. */
export function hasConsent(s: AssistantSettings): boolean {
  const c = s.consent;
  return !!c && c.aiSend === true && c.host !== '' && c.host === hostOf(s.provider.baseUrl);
}

export function grantConsent(s: AssistantSettings, now = new Date()): AssistantSettings {
  const consent: Consent = { aiSend: true, host: hostOf(s.provider.baseUrl), at: now.toISOString() };
  return { ...s, consent };
}

/** Returns null when AI may be used, otherwise a Vietnamese reason why offline mode is used. */
export function aiBlockedReason(s: AssistantSettings, apiKey: string, online: boolean): string | null {
  if (!s.useAi) return 'AI đang tắt, dùng chế độ offline.';
  // A model running inside the app sends nothing anywhere: no consent, network or key needed.
  if (s.provider.kind === 'webllm' || s.provider.kind === 'llamacpp') return null;
  if (!hasConsent(s)) return 'Bạn chưa đồng ý gửi tin nhắn cho dịch vụ AI nên dùng chế độ offline.';
  if (!online) return 'Không có mạng, đang dùng chế độ offline.';
  const needsKey = s.provider.kind === 'anthropic' || !isLocalHost(hostOf(s.provider.baseUrl));
  if (needsKey && !apiKey.trim()) return 'Chưa nhập khoá API nên dùng chế độ offline.';
  return null;
}

export function startRoleplay(scenarioId: string) {
  return roleplayOpening(scenarioId);
}

export async function respond(
  input: { mode: AssistMode; text: string; history: ChatMessage[]; settings: AssistantSettings; apiKey: string; roleplay?: RoleplayState },
  deps: Deps = {}
): Promise<Reply> {
  const { mode, text, history, settings, apiKey, roleplay } = input;
  const rand = deps.rand ?? Math.random;
  const online = deps.online ? deps.online() : typeof navigator === 'undefined' || navigator.onLine;
  const blocked = aiBlockedReason(settings, apiKey, online);

  const offline = (notice?: string): Reply => {
    if (mode === 'roleplay' && roleplay) {
      const r = offlineRoleplay(text, roleplay, settings.style, rand);
      return { text: r.text, source: 'offline', notice, roleplay: r.state, judged: { step: roleplay.step, ok: r.ok } };
    }
    const body = mode === 'grammar' ? offlineGrammar(text) : mode === 'correct' ? offlineCorrect(text, settings.style, rand) : offlineChat(text, settings.style, rand);
    return { text: body, source: 'offline', notice };
  };

  if (blocked) return offline(settings.useAi ? blocked : undefined);

  const sent = [...history, { role: 'user' as const, text }].slice(-MAX_SENT_TURNS);
  try {
    const answer = await callAi(settings.provider, apiKey, buildSystemPrompt(settings, mode, roleplay), sent, deps.fetch);
    let nextRp: RoleplayState | undefined;
    if (mode === 'roleplay' && roleplay) nextRp = { ...roleplay, step: roleplay.step + 1, done: roleplay.step + 1 >= 6 };
    return { text: answer, source: 'ai', roleplay: nextRp };
  } catch (e) {
    const why = e instanceof Error ? e.message : 'lỗi không rõ';
    return offline(`Không gọi được AI (${why}), tạm dùng chế độ offline.`);
  }
}
