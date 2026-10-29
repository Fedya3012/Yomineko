// Rewrites a summary in a chosen style. The offline version is template-based; the AI version is optional and
// only runs with the same explicit opt-in the assistant uses (see assistant.ts `aiBlockedReason`).
import { aiBlockedReason } from '../assistant/assistant';
import { callAi, type FetchLike } from '../assistant/ai';
import type { AssistantSettings } from '../assistant/types';
import { formatDuration } from '../progress/stats';
import { summaryToText, type StudySummary } from './summary';

export type SummaryStyle = 'standard' | 'cheerful' | 'strict' | 'brief' | 'diary';
export const STYLE_LABEL: Record<SummaryStyle, string> = {
  standard: 'Chuẩn', cheerful: 'Vui vẻ, khích lệ', strict: 'Nghiêm khắc, thẳng thắn', brief: 'Ngắn gọn (3 dòng)', diary: 'Nhật ký của Mochi'
};
export const STYLES = Object.keys(STYLE_LABEL) as SummaryStyle[];

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function rewriteOffline(s: StudySummary, style: SummaryStyle): string {
  if (style === 'standard') return summaryToText(s);
  const time = formatDuration(s.seconds);
  const empty = s.cards === 0 && s.seconds === 0;
  const weak = s.weaknesses[0]?.label;
  const tip = s.suggestions[0];
  if (empty) return style === 'strict' ? `${s.range.title}: không có buổi học nào. Hãy học ngay hôm nay.` : `${s.range.title}: chưa có buổi học nào. Mochi đang chờ bạn quay lại nhé 🐱`;
  if (style === 'brief') return [`${s.range.title}: ${time}, ${s.cards} lượt, đúng ${pct(s.accuracy)}.`, weak ? `Yếu nhất: ${weak}.` : 'Chưa có điểm yếu rõ rệt.', `Tiếp theo: ${tip}`].join('\n');
  if (style === 'cheerful') return [`Tuyệt vời! ${s.range.title} bạn đã học ${time} qua ${s.sessions} buổi 🎉`,
    `Trả lời đúng ${pct(s.accuracy)} trong ${s.cards} lượt, giỏi lắm!`,
    s.strengths[0] ? `Điểm sáng: ${s.strengths[0]} ✨` : 'Mỗi bước nhỏ đều đáng khen!',
    weak ? `Chỉ cần chú ý thêm "${weak}" là tiến bộ vèo vèo thôi 💪` : 'Chưa thấy chỗ nào vướng, cứ thế phát huy nhé!',
    `Gợi ý nhỏ: ${tip}`].join('\n');
  if (style === 'strict') return [`${s.range.title}: ${time}, ${s.cards} lượt, đúng ${pct(s.accuracy)}.`,
    s.accuracy < 0.8 ? 'Kết quả chưa đạt. Bạn đang đoán nhiều hơn là nhớ.' : 'Kết quả ổn, nhưng chưa phải giới hạn của bạn.',
    weak ? `Lỗi lặp lại: ${s.weaknesses.map((w) => w.label).join(', ')}. Sửa trước khi học thêm nội dung mới.` : 'Không có lỗi lặp lại đáng kể.',
    `Việc cần làm: ${tip}`].join('\n');
  // diary
  return [`Nhật ký của Mochi — ${s.range.title}`,
    `Hôm nay bạn ngồi học ${time}, Mochi nằm cạnh nghe bạn đọc ${s.cards} lượt. Đúng ${pct(s.accuracy)}, đuôi Mochi vẫy nhẹ.`,
    weak ? `Có chỗ "${weak}" làm bạn vấp vài lần, Mochi nhớ để nhắc bạn ôn.` : 'Không có chỗ nào vấp, Mochi thấy yên tâm.',
    `Mai thử: ${tip}`].join('\n');
}

const STYLE_PROMPT: Record<SummaryStyle, string> = {
  standard: 'giọng trung tính, rõ ràng', cheerful: 'giọng vui vẻ, khích lệ, có vài emoji', strict: 'giọng nghiêm khắc, thẳng thắn nhưng tôn trọng',
  brief: 'chỉ 3 dòng ngắn gọn', diary: 'dưới dạng nhật ký ngắn của chú mèo Mochi, ấm áp'
};

export interface RewriteResult { text: string; source: 'ai' | 'offline'; notice?: string }

/**
 * What would be sent: only the aggregated summary text (totals, a few item labels), never raw history.
 * The UI shows this exact text before the user presses "Viết lại bằng AI".
 */
export const aiPayload = (s: StudySummary) => summaryToText(s);

export async function rewriteSummary(
  s: StudySummary, style: SummaryStyle,
  ai: { settings: AssistantSettings; apiKey: string },
  deps: { fetch?: FetchLike; online?: () => boolean } = {}
): Promise<RewriteResult> {
  const offline = (notice?: string): RewriteResult => ({ text: rewriteOffline(s, style), source: 'offline', notice });
  const online = deps.online ? deps.online() : typeof navigator === 'undefined' || navigator.onLine;
  const blocked = aiBlockedReason(ai.settings, ai.apiKey, online);
  if (blocked) return offline(blocked);
  const system = `Bạn là Mochi, trợ lý học tiếng Nhật. Viết lại bản tổng kết học tập dưới đây bằng tiếng Việt, ${STYLE_PROMPT[style]}. Giữ nguyên mọi con số, không bịa thêm dữ liệu.`;
  try {
    const text = await callAi(ai.settings.provider, ai.apiKey, system, [{ role: 'user', text: aiPayload(s) }], deps.fetch);
    return { text, source: 'ai' };
  } catch (e) {
    return offline(`Không gọi được AI (${e instanceof Error ? e.message : 'lỗi không rõ'}), dùng bản viết lại offline.`);
  }
}
