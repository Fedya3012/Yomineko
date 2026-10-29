// Minimal EPUB reader: unzip, read the package file, list chapters, build one chapter as a safe HTML page.
// Nothing is uploaded; the learner's own file is parsed on the device.
import { strFromU8, unzipSync } from 'fflate';

export interface EpubChapter { href: string; title: string }
export interface EpubBook { title: string; chapters: EpubChapter[]; chapterHtml(index: number): string }

const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
/** Resolves "../img/a.png" relative to a file path inside the zip. */
export function resolvePath(from: string, rel: string): string {
  const out = (rel.startsWith('/') ? '' : dirname(from)).split('/').filter(Boolean);
  for (const part of decodeURIComponent(rel.split('#')[0]).split('/')) {
    if (part === '..') out.pop(); else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' };
const toDataUrl = (bytes: Uint8Array, path: string) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'};base64,${btoa(bin)}`;
};

export class EpubError extends Error {}

export function parseEpub(data: Uint8Array): EpubBook {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(data); } catch { throw new EpubError('Đây không phải file EPUB hợp lệ'); }
  const text = (path: string) => { const f = files[path]; if (!f) throw new EpubError(`Thiếu file ${path} trong EPUB`); return strFromU8(f); };
  const xml = (s: string) => new DOMParser().parseFromString(s, 'application/xml');

  const container = xml(text('META-INF/container.xml'));
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new EpubError('EPUB không có file mô tả (OPF)');
  const opf = xml(text(opfPath));

  const manifest = new Map<string, { href: string; type: string }>();
  for (const it of Array.from(opf.querySelectorAll('manifest > item')))
    manifest.set(it.getAttribute('id') ?? '', { href: resolvePath(opfPath, it.getAttribute('href') ?? ''), type: it.getAttribute('media-type') ?? '' });
  const chapters: EpubChapter[] = Array.from(opf.querySelectorAll('spine > itemref'))
    .map((r) => manifest.get(r.getAttribute('idref') ?? ''))
    .filter((m): m is { href: string; type: string } => !!m && /html/.test(m.type) && !!files[m.href])
    .map((m, i) => ({ href: m.href, title: `Phần ${i + 1}` }));
  if (!chapters.length) throw new EpubError('EPUB không có nội dung để đọc');

  const title = Array.from(opf.getElementsByTagName('*')).find((n) => n.localName === 'title')?.textContent?.trim() || 'EPUB';

  function chapterHtml(index: number): string {
    const ch = chapters[index];
    if (!ch) return '';
    // Pull stylesheet links out of the raw text first so the parser never tries to fetch them.
    const hrefs: string[] = [];
    const raw = text(ch.href).replace(/<link\b[^>]*>/gi, (tag) => {
      if (/rel=["']?[^"'>]*stylesheet/i.test(tag)) hrefs.push(/href=["']([^"']+)["']/i.exec(tag)?.[1] ?? '');
      return '';
    });
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed').forEach((n) => n.remove());
    doc.querySelectorAll('[onclick], [onload], [onerror]').forEach((n) => Array.from(n.attributes).filter((a) => a.name.startsWith('on')).forEach((a) => n.removeAttribute(a.name)));
    for (const img of Array.from(doc.querySelectorAll('img, image'))) {
      const attr = img.hasAttribute('src') ? 'src' : img.hasAttribute('href') ? 'href' : 'xlink:href';
      const ref = img.getAttribute(attr);
      const path = ref && !/^(data:|https?:)/.test(ref) ? resolvePath(ch.href, ref) : '';
      if (path && files[path]) img.setAttribute(attr, toDataUrl(files[path], path));
      else if (ref && /^https?:/.test(ref)) img.removeAttribute(attr);
    }
    let css = '';
    for (const h of hrefs) {
      const p = resolvePath(ch.href, h);
      if (files[p]) css += strFromU8(files[p]);
    }
    const style = doc.createElement('style');
    style.textContent = css + '\nimg,svg{max-width:100%;height:auto}body{padding:1rem;line-height:1.9;font-family:"Zen Maru Gothic","Noto Sans JP","Hiragino Sans","Yu Gothic",sans-serif}';
    doc.head.appendChild(style);
    const heading = doc.querySelector('h1, h2, title')?.textContent?.trim();
    if (heading) ch.title = heading.slice(0, 60);
    return '<!doctype html>' + doc.documentElement.outerHTML;
  }
  return { title, chapters, chapterHtml };
}
