// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { EpubError, parseEpub, resolvePath } from './epub';

const png = new Uint8Array([137, 80, 78, 71]);
function makeEpub(extra: Record<string, Uint8Array> = {}) {
  return zipSync({
    'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'),
    'OEBPS/content.opf': strToU8(`<package><metadata><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">本のテスト</dc:title></metadata>
      <manifest><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
      <item id="img" href="img/a.png" media-type="image/png"/><item id="css" href="s.css" media-type="text/css"/></manifest>
      <spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`),
    'OEBPS/ch1.xhtml': strToU8('<html><head><link rel="stylesheet" href="s.css"/></head><body><h1>第一章</h1><p><ruby>猫<rt>ねこ</rt></ruby></p><img src="img/a.png"/><script>alert(1)</script><p onclick="x()">a</p></body></html>'),
    'OEBPS/text/ch2.xhtml': strToU8('<html><body><h1>第二章</h1><img src="../img/a.png"/></body></html>'),
    'OEBPS/img/a.png': png, 'OEBPS/s.css': strToU8('p{color:red}'), ...extra
  });
}

describe('EPUB reader', () => {
  it('reads title and chapters in spine order', () => {
    const b = parseEpub(makeEpub());
    expect(b.title).toBe('本のテスト');
    expect(b.chapters).toHaveLength(2);
    expect(b.chapterHtml(1)).toContain('第二章');
    expect(b.chapters[1].title).toBe('第二章');
  });
  it('keeps furigana, inlines images and styles, and strips scripts and handlers', () => {
    const html = parseEpub(makeEpub()).chapterHtml(0);
    expect(html).toContain('<rt>ねこ</rt>');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('color:red');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(parseEpub(makeEpub()).chapterHtml(1)).toContain('data:image/png'); // "../img/a.png" resolved
  });
  it('rejects things that are not EPUB with a readable error', () => {
    expect(() => parseEpub(strToU8('hello'))).toThrow(EpubError);
    expect(() => parseEpub(zipSync({ 'a.txt': strToU8('x') }))).toThrow(/container/);
  });
  it('resolves relative paths inside the zip', () => {
    expect(resolvePath('OEBPS/text/ch2.xhtml', '../img/a%20b.png')).toBe('OEBPS/img/a b.png');
    expect(resolvePath('OEBPS/c.opf', 'ch1.xhtml#x')).toBe('OEBPS/ch1.xhtml');
  });
});
