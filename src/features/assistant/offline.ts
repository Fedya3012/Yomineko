import { CHAT_REPLIES, CORRECTION_RULES, GRAMMAR, TOPIC_LIST } from './offline-data';
import { PHRASES } from './personas';
import { getScenario } from './scenarios';
import type { RoleplayState, Style } from './types';

/** Picks one item. `rand` is injectable so tests are deterministic. */
const pick = <T>(xs: T[], rand: () => number) => xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))];

export function offlineGrammar(text: string): string {
  const q = text.toLowerCase();
  const hit = GRAMMAR.filter((g) => g.keys.some((k) => q.includes(k.toLowerCase())));
  if (hit.length === 0) {
    return `Chế độ offline có sẵn các bài này, bạn gõ từ khoá (ví dụ は, ます, て形) để xem:\n• ${TOPIC_LIST}`;
  }
  return hit.slice(0, 3).map((g) => `【${g.title}】\n${g.body}`).join('\n\n');
}

export interface Correction { corrected: string; tips: string[] }

export function checkSentence(text: string): Correction {
  let corrected = text;
  const tips: string[] = [];
  for (const rule of CORRECTION_RULES) {
    const next = corrected.replace(rule.test, rule.replace as string);
    if (next !== corrected) { tips.push(rule.tip); corrected = next; }
  }
  return { corrected, tips };
}

export function offlineCorrect(text: string, style: Style, rand = Math.random): string {
  const { corrected, tips } = checkSentence(text.trim());
  if (tips.length === 0) {
    return `${pick(PHRASES[style].praise, rand)}\nMình không thấy lỗi thường gặp nào trong câu này. (Chế độ offline chỉ kiểm tra các lỗi phổ biến; bật AI để kiểm tra kỹ hơn.)`;
  }
  return `${pick(PHRASES[style].retry, rand)}\nCâu đã sửa: ${corrected}\n${tips.map((t) => `• ${t}`).join('\n')}`;
}

export function offlineChat(text: string, style: Style, rand = Math.random): string {
  const q = text.toLowerCase();
  const hit = CHAT_REPLIES.find((r) => r.keys.some((k) => q.includes(k.toLowerCase())));
  if (hit) return `${hit.ja}\n${hit.vi}`;
  return `${pick(PHRASES[style].cheer, rand)}\nMình đang ở chế độ offline nên chỉ trả lời được vài câu chào hỏi. Bạn thử bấm "Giải thích ngữ pháp", "Sửa câu" hoặc "Nhập vai" nhé.`;
}

export function roleplayOpening(scenarioId: string): { state: RoleplayState; text: string } {
  const sc = getScenario(scenarioId);
  if (!sc) throw new Error('Không tìm thấy tình huống');
  const t = sc.turns[0];
  return {
    state: { scenarioId, step: 0, done: false },
    text: `Tình huống: ${sc.title}. Bạn đang ở ${sc.place}.\n${t.npc}\n(${t.gloss})`
  };
}

export function offlineRoleplay(text: string, state: RoleplayState, style: Style, rand = Math.random): { state: RoleplayState; text: string; ok: boolean } {
  const sc = getScenario(state.scenarioId);
  if (!sc || state.done) throw new Error('Tình huống đã kết thúc');
  const turn = sc.turns[state.step];
  const ok = turn.expect.some((k) => text.includes(k));
  const feedback = ok
    ? pick(PHRASES[style].praise, rand)
    : `${pick(PHRASES[style].retry, rand)}\nCâu mẫu: ${turn.model} (${turn.modelGloss})`;
  const nextStep = state.step + 1;
  if (nextStep >= sc.turns.length) {
    return { ok, state: { ...state, step: nextStep, done: true }, text: `${feedback}\n\nKết thúc tình huống rồi! ${pick(PHRASES[style].cheer, rand)}` };
  }
  const next = sc.turns[nextStep];
  return { ok, state: { ...state, step: nextStep }, text: `${feedback}\n\n${next.npc}\n(${next.gloss})` };
}
