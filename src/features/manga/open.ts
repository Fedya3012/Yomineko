import { bookIdFor } from './pages';
import { detectFormat } from './formats';
import { hasImages, pagesFromFiles } from './sources/folder';
import { openCbz } from './sources/cbz';
import type { Book, PageRef } from './types';

/** URLs of the self-hosted helper files (see scripts/copy-vendor-assets.mjs). Injected so tests need no browser. */
export interface Assets { libarchiveWorker: string; pdfWorker: string }

const stripExt = (n: string) => n.replace(/\.[^.]+$/, '');

/**
 * Turn whatever the learner picked into a Book:
 *  - one CBZ / CBR / PDF file, or
 *  - a folder / several images (we never need to copy or upload anything).
 */
export async function openBook(files: File[], assets: Assets): Promise<Book> {
  if (!files.length) throw new Error('Chưa chọn tệp nào.');

  const single = files.length === 1 ? files[0] : undefined;
  if (single && !hasImages(files)) {
    const head = new Uint8Array(await single.slice(0, 8).arrayBuffer());
    const format = detectFormat(head, single.name);
    let pages: PageRef[];
    let close = () => {};
    if (format === 'cbz') pages = await openCbz(single);
    else if (format === 'cbr') ({ pages, close } = await (await import('./sources/cbr')).openCbr(single, assets.libarchiveWorker));
    else if (format === 'pdf') ({ pages, close } = await (await import('./sources/pdf')).openPdf(single, assets.pdfWorker));
    else throw new Error('Định dạng này chưa hỗ trợ. Hãy chọn CBZ, CBR, PDF hoặc thư mục ảnh.');
    if (!pages.length) throw new Error('Không tìm thấy trang ảnh nào trong tệp này.');
    const title = stripExt(single.name);
    return { id: bookIdFor(title, single.size, pages.length), title, format, pages, close };
  }

  const { pages, title } = pagesFromFiles(files);
  if (!pages.length) throw new Error('Không tìm thấy ảnh (JPG, PNG, WebP...) trong thư mục này.');
  const size = files.reduce((n, f) => n + f.size, 0);
  return { id: bookIdFor(title, size, pages.length), title, format: 'images', pages, close() {} };
}
