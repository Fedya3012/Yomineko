import type { PageRef } from '../types';

/** Longest edge we render a PDF page at. Big enough to read small text and for OCR, small enough for phones. */
const TARGET_WIDTH = 1600;
const MAX_SCALE = 3;

/** Open a PDF with PDF.js (Apache-2.0). Each page is drawn to a canvas the first time it is needed. */
export async function openPdf(file: Blob, workerUrl: string): Promise<{ pages: PageRef[]; close(): void }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: PageRef[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    pages.push({
      name: `page-${String(n).padStart(4, '0')}.png`,
      async load() {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: Math.min(MAX_SCALE, TARGET_WIDTH / base.width) });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
        canvas.width = canvas.height = 0; // free the bitmap right away
        if (!blob) throw new Error('Không vẽ được trang PDF này.');
        return blob;
      }
    });
  }
  return { pages, close: () => { void task.destroy(); } };
}
