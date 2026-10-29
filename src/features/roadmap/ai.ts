// Optional AI touch-up. The AI can only reword the summary and add tips; it never changes the schedule,
// so a wrong or missing answer can't break the plan. Same privacy gates as the assistant: off by default,
// needs consent for the exact host, and every failure falls back to the rule-based roadmap.
import { aiBlockedReason } from '../assistant/assistant';
import { callAi, type FetchLike } from '../assistant/ai';
import type { AssistantSettings } from '../assistant/types';
import { describeAnswers } from './data';
import type { Roadmap } from './types';

export interface AiDeps { fetch?: FetchLike; online?: () => boolean }

const SYSTEM = [
  'Bạn là Mochi, trợ lý của ứng dụng học tiếng Nhật Yomineko.',
  'Dựa vào thông tin người học, viết lời tóm tắt lộ trình (tối đa 2 câu) và tối đa 3 lời khuyên ngắn, bằng tiếng Việt đơn giản, giọng khích lệ.',
  'Chỉ trả về đúng một đối tượng JSON, không thêm chữ nào khác: {"summary": "...", "tips": ["...", "..."]}'
].join('\n');

/** Pulls the first JSON object out of a reply and keeps only safe, short strings. */
export function parseAiReply(text: string): { summary: string; tips: string[] } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const summary = typeof j.summary === 'string' ? j.summary.trim().slice(0, 400) : '';
    const tips = Array.isArray(j.tips) ? j.tips.filter((t: unknown): t is string => typeof t === 'string' && !!t.trim()).map((t: string) => t.trim().slice(0, 200)).slice(0, 3) : [];
    return summary || tips.length ? { summary, tips } : null;
  } catch {
    return null;
  }
}

export async function refineWithAi(road: Roadmap, settings: AssistantSettings, apiKey: string, deps: AiDeps = {}): Promise<Roadmap> {
  const online = deps.online ? deps.online() : typeof navigator === 'undefined' || navigator.onLine;
  const blocked = aiBlockedReason(settings, apiKey, online);
  if (blocked) return { ...road, notice: settings.useAi ? blocked : undefined };
  const stages = road.stages.map((s) => `${s.level} (${s.weeks} tuần)`).join(', ');
  try {
    const reply = await callAi(settings.provider, apiKey, SYSTEM, [{ role: 'user', text: `${describeAnswers(road.answers)}. Các giai đoạn: ${stages}.` }], deps.fetch);
    const parsed = parseAiReply(reply);
    if (!parsed) return { ...road, notice: 'AI trả lời không đúng dạng nên dùng lộ trình theo luật.' };
    return { ...road, source: 'ai', summary: parsed.summary || road.summary, tips: [...parsed.tips, ...road.tips].slice(0, 6), notice: undefined };
  } catch (e) {
    return { ...road, notice: `Không gọi được AI (${e instanceof Error ? e.message : 'lỗi'}), dùng lộ trình theo luật.` };
  }
}
