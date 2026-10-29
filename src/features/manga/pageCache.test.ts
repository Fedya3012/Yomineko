import { describe, expect, it, vi } from 'vitest';
import { PageCache, type PageIO } from './pageCache';
import type { PageRef } from './types';

function setup(count = 20) {
  const load = vi.fn(async () => new Blob(['x']));
  const pages: PageRef[] = Array.from({ length: count }, (_, i) => ({ name: `${i}.png`, load }));
  const revoked: string[] = [];
  let n = 0;
  const io: PageIO = { makeUrl: () => `blob:${n++}`, revokeUrl: (u) => revoked.push(u), measure: async () => ({ width: 800, height: 1200 }) };
  return { cache: new PageCache(pages, io, 2), load, revoked };
}

describe('PageCache', () => {
  it('loads a page once and shares the result', async () => {
    const { cache, load } = setup();
    const [a, b] = await Promise.all([cache.get(3), cache.get(3)]);
    expect(a).toBe(b);
    expect(a).toMatchObject({ width: 800, height: 1200 });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('frees pages far from the reader', async () => {
    const { cache, revoked } = setup();
    await Promise.all([0, 1, 5, 6].map((i) => cache.get(i)));
    cache.trim(5); // keeps 3..7
    expect(revoked).toHaveLength(2); // pages 0 and 1
    cache.dispose();
    expect(revoked).toHaveLength(4);
  });

  it('retries after a failed load', async () => {
    const { cache, load } = setup();
    load.mockRejectedValueOnce(new Error('boom'));
    await expect(cache.get(0)).rejects.toThrow('boom');
    await expect(cache.get(0)).resolves.toBeDefined();
  });
});
