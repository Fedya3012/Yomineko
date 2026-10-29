import { describe, it, expect } from 'vitest';
import { buildRoleplayReport } from './report';

describe('buildRoleplayReport', () => {
  it('lists judged turns, never marks anything as learned', () => {
    const r = buildRoleplayReport('konbini', [{ step: 0, ok: true }, { step: 1, ok: false }], 0, 120_000)!;
    expect(r.source).toBe('Nhập vai');
    expect(r.seconds).toBe(120);
    expect(r.items).toHaveLength(2);
    expect(r.items.map((i) => i.correct)).toEqual([true, false]);
    expect(r.items.some((i) => i.learned)).toBe(false);
    expect(r.items[1].label).toBe('はい、ください。');
  });
  it('skips empty, very short sessions and unknown scenarios', () => {
    expect(buildRoleplayReport('konbini', [], 0, 5000)).toBeUndefined();
    expect(buildRoleplayReport('nope', [], 0, 999999)).toBeUndefined();
  });
  it('still reports time for AI-judged sessions with no checked turns', () => {
    expect(buildRoleplayReport('intro', [], 0, 90_000)?.items).toEqual([]);
  });
});
