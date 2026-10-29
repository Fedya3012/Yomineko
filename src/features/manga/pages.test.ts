import { describe, expect, it } from 'vitest';
import { bookIdFor, isPageName, mimeForName, sortPageNames } from './pages';

describe('pages', () => {
  it('keeps images and drops junk files', () => {
    expect(isPageName('ch1/001.jpg')).toBe(true);
    expect(isPageName('ch1/001.WEBP')).toBe(true);
    expect(isPageName('ComicInfo.xml')).toBe(false);
    expect(isPageName('Thumbs.db')).toBe(false);
    expect(isPageName('__MACOSX/ch1/._001.jpg')).toBe(false);
    expect(isPageName('ch1/.hidden.png')).toBe(false);
    expect(isPageName('folder/')).toBe(false);
  });

  it('sorts naturally: page2 before page10, chapters in order', () => {
    const names = ['p10.png', 'p2.png', 'p1.png', 'c2/001.png', 'c1/002.png', 'c1/001.png', 'notes.txt'];
    expect(sortPageNames(names, (n) => n)).toEqual(['c1/001.png', 'c1/002.png', 'c2/001.png', 'p1.png', 'p2.png', 'p10.png']);
  });

  it('knows the mime type', () => {
    expect(mimeForName('a.jpg')).toBe('image/jpeg');
    expect(mimeForName('a.PNG')).toBe('image/png');
  });

  it('makes a stable id per book', () => {
    expect(bookIdFor('OP', 100, 10)).toBe(bookIdFor('OP', 100, 10));
    expect(bookIdFor('OP', 100, 10)).not.toBe(bookIdFor('OP', 101, 10));
  });
});
