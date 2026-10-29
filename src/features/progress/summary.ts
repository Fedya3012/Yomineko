import { formatDuration } from './stats';
import type { ItemKind, SessionSummary } from './types';

const KIND_LABEL: Record<ItemKind, string> = { word: 'từ vựng', kanji: 'kanji', grammar: 'ngữ pháp' };
const unitLabel = (u: 'minutes' | 'cards') => (u === 'minutes' ? 'phút' : 'thẻ');
const pct = (r: number) => `${Math.round(r * 100)}%`;

function newLines(s: SessionSummary): string[] {
  return (Object.keys(KIND_LABEL) as ItemKind[]).filter((k) => s.newlyLearned[k] > 0).map((k) => `${s.newlyLearned[k]} ${KIND_LABEL[k]} mới`);
}

/** Plain text, short enough to paste into a chat. */
export function summaryToText(s: SessionSummary): string {
  const lines = [
    `Buổi học ${s.date}${s.source ? ` (${s.source})` : ''}`,
    `${formatDuration(s.minutes * 60)} · ${s.cards} thẻ · đúng ${pct(s.accuracy)} (${s.correct}/${s.cards})`
  ];
  const nl = newLines(s);
  if (nl.length) lines.push(`Mới học: ${nl.join(', ')}`);
  if (s.weak.length) lines.push(`Cần ôn thêm: ${s.weak.map((w) => `${w.label} (sai ${w.misses})`).join(', ')}`);
  lines.push(`Mục tiêu ngày: ${s.goal.done}/${s.goal.target} ${unitLabel(s.goal.unit)}${s.goal.met ? ' ✔' : ''}`);
  lines.push(`Chuỗi ngày học: ${s.streak} ngày`);
  return lines.join('\n');
}

export function summaryToMarkdown(s: SessionSummary): string {
  const out = [`# Buổi học ${s.date}${s.source ? ` · ${s.source}` : ''}`, '',
    `- **Thời gian:** ${formatDuration(s.minutes * 60)}`,
    `- **Số thẻ:** ${s.cards}`,
    `- **Độ chính xác:** ${pct(s.accuracy)} (${s.correct}/${s.cards})`,
    `- **Mục tiêu ngày:** ${s.goal.done}/${s.goal.target} ${unitLabel(s.goal.unit)}${s.goal.met ? ' ✔' : ''}`,
    `- **Chuỗi ngày học:** ${s.streak} ngày`];
  const nl = newLines(s);
  if (nl.length) out.push('', '## Mới học', ...nl.map((l) => `- ${l}`));
  if (s.weak.length) out.push('', '## Cần ôn thêm', ...s.weak.map((w) => `- ${w.label} — sai ${w.misses} lần`));
  return out.join('\n') + '\n';
}

export const summaryFileName = (s: SessionSummary) => `yomineko-buoi-hoc-${s.date}.md`;
