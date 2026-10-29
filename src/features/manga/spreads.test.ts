import { describe, expect, it } from 'vitest';
import { arrowToStep, buildSpreads, screenOrder, spreadIndexOf } from './spreads';

const none = () => false;

describe('buildSpreads', () => {
  it('single mode: one page per spread', () => {
    expect(buildSpreads(3, none, { mode: 'single', coverAlone: true })).toEqual([[0], [1], [2]]);
  });
  it('double mode keeps the cover alone and pairs the rest', () => {
    expect(buildSpreads(6, none, { mode: 'double', coverAlone: true })).toEqual([[0], [1, 2], [3, 4], [5]]);
  });
  it('double mode without cover pairs from page 1', () => {
    expect(buildSpreads(5, none, { mode: 'double', coverAlone: false })).toEqual([[0, 1], [2, 3], [4]]);
  });
  it('wide pages always stand alone and re-pair their neighbours', () => {
    const wide = (p: number) => p === 3;
    expect(buildSpreads(7, wide, { mode: 'double', coverAlone: true })).toEqual([[0], [1, 2], [3], [4, 5], [6]]);
  });
  it('a page before a wide page is shown alone instead of being paired with it', () => {
    expect(buildSpreads(4, (p) => p === 2, { mode: 'double', coverAlone: false })).toEqual([[0, 1], [2], [3]]);
  });
  it('handles empty and single-page books', () => {
    expect(buildSpreads(0, none, { mode: 'double', coverAlone: true })).toEqual([]);
    expect(buildSpreads(1, none, { mode: 'double', coverAlone: false })).toEqual([[0]]);
  });
});

describe('direction', () => {
  it('rtl puts the earlier page on the right', () => {
    expect(screenOrder([4, 5], 'rtl')).toEqual([5, 4]);
    expect(screenOrder([4, 5], 'ltr')).toEqual([4, 5]);
  });
  it('arrow keys follow the book direction', () => {
    expect(arrowToStep('ArrowLeft', 'rtl')).toBe(1);
    expect(arrowToStep('ArrowRight', 'rtl')).toBe(-1);
    expect(arrowToStep('ArrowRight', 'ltr')).toBe(1);
    expect(arrowToStep('ArrowLeft', 'ltr')).toBe(-1);
  });
  it('finds the spread holding a page', () => {
    expect(spreadIndexOf([[0], [1, 2], [3, 4]], 4)).toBe(2);
    expect(spreadIndexOf([[0], [1, 2]], 99)).toBe(0);
  });
});
