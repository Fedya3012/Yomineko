import { describe, it, expect } from 'vitest';
import { resolveTheme } from './settings';

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
