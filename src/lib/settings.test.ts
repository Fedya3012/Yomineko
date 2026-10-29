import { describe, it, expect } from 'vitest';
import { resolveTheme, clampScale } from './settings';

describe('resolveTheme', () => {
  it('follows the OS when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  it('respects an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('clampScale', () => {
  it('keeps text between 100% and 200%', () => {
    expect(clampScale(0.5)).toBe(1);
    expect(clampScale(3)).toBe(2);
    expect(clampScale(1.5)).toBe(1.5);
    expect(clampScale(NaN)).toBe(1);
  });
});
