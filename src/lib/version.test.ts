import { describe, it, expect } from 'vitest';
import { compareVersions, isVersion } from './version';

describe('compareVersions', () => {
  it('orders numerically, not as text', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('0.1.0', '0.1.1')).toBeLessThan(0);
  });
  it('rejects text that is not a version', () => {
    expect(isVersion('latest')).toBe(false);
    expect(() => compareVersions('abc', '1.0.0')).toThrow();
  });
});
