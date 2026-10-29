import { describe, it, expect } from 'vitest';
import { DATA_LICENSES, SHARE_ALIKE_NOTE } from './licenses';
import { samplePack } from './fixtures';
import { validatePack } from '../../lib/packs/format';

describe('data licenses', () => {
  it('lists every data set with a name, license and links, and only open (Creative Commons) licenses', () => {
    expect(DATA_LICENSES.map((l) => l.id)).toEqual(['jmdict', 'jitendex', 'kanjidic', 'tatoeba', 'jlpt-lists']);
    for (const l of DATA_LICENSES) {
      expect(l.license).toMatch(/^CC /);
      expect(l.url).toMatch(/^https:\/\//);
      expect(l.licenseUrl).toMatch(/^https:\/\//);
      expect(l.by).not.toBe('');
    }
    expect(SHARE_ALIKE_NOTE).toMatch(/CC BY-SA/);
  });

  it('the bundled sample pack is valid and CC0', () => {
    expect(validatePack(samplePack).manifest.license.name).toBe('CC0 1.0');
  });
});
