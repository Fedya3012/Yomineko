import { describe, it, expect } from 'vitest';
import { gradeAnswer, similarity, SIMPLE_GRADING_LABEL } from './grade';
import { SCENARIOS, getScenario } from './scenarios';
import { offlineRoleplay, roleplayOpening } from './offline';

const turn = (id: string, i: number) => getScenario(id)!.turns[i];

describe('offline grading is strict', () => {
  it('rejects a bare keyword that used to pass', () => {
    expect(gradeAnswer('はい', turn('konbini', 0)).ok).toBe(false);
  });
  it('rejects a keyword buried in unrelated text', () => {
    expect(gradeAnswer('はい、りんごがすきです', turn('konbini', 0)).ok).toBe(false);
  });
  it('accepts the model answer and listed alternatives for every turn', () => {
    for (const sc of SCENARIOS) for (const t of sc.turns) {
      expect(gradeAnswer(t.model, t).ok, t.model).toBe(true);
      for (const a of t.alts ?? []) expect(gradeAnswer(a, t).ok, a).toBe(true);
    }
  });
  it('ignores punctuation and spaces', () => {
    expect(gradeAnswer('はい お願いします', turn('konbini', 0)).ok).toBe(true);
  });
  it('accepts open-ended answers that fit the pattern, rejects ones that do not', () => {
    expect(gradeAnswer('はじめまして。たろうです。', turn('intro', 0)).ok).toBe(true);
    expect(gradeAnswer('日本から来ました。', turn('intro', 1)).ok).toBe(true);
    expect(gradeAnswer('です', turn('intro', 0)).ok).toBe(false);
    expect(gradeAnswer('から', turn('intro', 1)).ok).toBe(false);
  });
  it('similarity is 0 for strings too short to compare', () => {
    expect(similarity('は', 'はい')).toBe(0);
  });
});

describe('offline feedback is labelled', () => {
  it('shows the simple-grading label on both pass and fail', () => {
    const { state } = roleplayOpening('konbini');
    const fail = offlineRoleplay('はい', state, 'gentle', () => 0);
    expect(fail.text).toContain(SIMPLE_GRADING_LABEL);
    expect(fail.text).toContain('Câu mẫu');
    const pass = offlineRoleplay('はい、お願いします。', state, 'gentle', () => 0);
    expect(pass.text).toContain(SIMPLE_GRADING_LABEL);
    expect(pass.ok).toBe(true);
  });
});
