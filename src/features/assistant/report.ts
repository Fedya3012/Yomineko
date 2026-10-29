import { getScenario } from './scenarios';

/**
 * Same shape as `SessionInput` in features/progress/types.ts (Progress thread, PR #1), declared here so the
 * assistant has no hard dependency on code that has not landed yet. Once Progress is merged, App.svelte passes
 * `onSessionEnd={(r) => recordSession(db, r)}`; TypeScript checks the two shapes match.
 */
export interface SessionReport {
  endedAt: number;
  seconds: number;
  source?: string;
  items: { kind: 'word' | 'kanji' | 'grammar'; id: string; label: string; correct: boolean; learned?: boolean }[];
}

export interface TurnResult { step: number; ok: boolean }

/**
 * Turns a finished role-play into a progress report. Only turns we could actually judge (offline checking) are
 * included; `learned` is never set, because speaking practice should not inflate the "items learned" counters.
 */
export function buildRoleplayReport(scenarioId: string, results: TurnResult[], startedAt: number, endedAt: number): SessionReport | undefined {
  const sc = getScenario(scenarioId);
  if (!sc) return undefined;
  const seconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  if (results.length === 0 && seconds < 30) return undefined;
  return {
    endedAt, seconds, source: 'Nhập vai',
    items: results.map((r) => ({ kind: 'grammar', id: `roleplay:${scenarioId}:${r.step}`, label: sc.turns[r.step].model, correct: r.ok }))
  };
}
