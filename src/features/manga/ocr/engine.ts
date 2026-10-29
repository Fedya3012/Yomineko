// Offline Japanese OCR on top of tesseract.js (Apache-2.0, runs in a Web Worker / WebAssembly).
// Language data: Tesseract "best_int" jpn + jpn_vert models (Apache-2.0), bundled so no network is needed.
import type { Worker as TessWorker } from 'tesseract.js';
import { mergeRuns, readingOrder, toBlocks } from './normalize';
import type { Box, OcrBlock, Orientation, RawBlock } from './types';

export interface OcrPaths {
  /** Folder URL/path holding jpn.traineddata.gz and jpn_vert.traineddata.gz. */
  langPath: string;
  /** tesseract.js worker script (browser only; Node finds its own). */
  workerPath?: string;
  /** Folder holding the tesseract-core*.wasm.js files (browser only). */
  corePath?: string;
}

export type OcrMode = 'auto' | Orientation;
export interface RecognizeOptions {
  mode?: OcrMode;
  /** Only read this rectangle of the image (page pixels). Much more accurate than a whole page. */
  region?: Box;
}

const MODEL: Record<Orientation, 'jpn' | 'jpn_vert'> = { horizontal: 'jpn', vertical: 'jpn_vert' };
const SPARSE_TEXT = '12'; // PSM 12: sparse text; unlike PSM 11 the vertical model needs this to find columns

export class OcrEngine {
  private workers = new Map<Orientation, Promise<TessWorker>>();

  constructor(private paths: OcrPaths) {}

  private worker(o: Orientation): Promise<TessWorker> {
    let p = this.workers.get(o);
    if (!p) {
      p = (async () => {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker(MODEL[o], 1, {
          langPath: this.paths.langPath,
          // undefined would override tesseract.js's own defaults (Node), so only pass what is set
          ...(this.paths.workerPath && { workerPath: this.paths.workerPath }),
          ...(this.paths.corePath && { corePath: this.paths.corePath }),
          gzip: true,
          cacheMethod: 'none' // the files are already local; no need for a second copy in IndexedDB
        });
        await worker.setParameters({ tessedit_pageseg_mode: SPARSE_TEXT as never, preserve_interword_spaces: '0' });
        return worker;
      })();
      p.catch(() => this.workers.delete(o));
      this.workers.set(o, p);
    }
    return p;
  }

  private async run(image: Blob | string, o: Orientation, region?: Box, force?: Orientation): Promise<OcrBlock[]> {
    const worker = await this.worker(o);
    const rectangle = region && { left: Math.round(region.x0), top: Math.round(region.y0), width: Math.round(region.x1 - region.x0), height: Math.round(region.y1 - region.y0) };
    const { data } = await worker.recognize(image, rectangle ? { rectangle } : {}, { blocks: true });
    return toBlocks(data.blocks as unknown as RawBlock[] | null, { model: o, force });
  }

  /**
   * Read the text on a page. 'auto' runs both models and keeps, for every spot, whichever model
   * produced a block of the matching shape (tall columns <- vertical model, wide rows <- horizontal model).
   */
  async recognize(image: Blob | string, opts: RecognizeOptions = {}): Promise<OcrBlock[]> {
    const mode = opts.mode ?? 'auto';
    if (mode !== 'auto') {
      return readingOrder(await this.run(image, mode, opts.region, mode));
    }
    // Sequential on purpose: two WebAssembly workers at once can exhaust memory on phones.
    const horizontal = await this.run(image, 'horizontal', opts.region);
    const vertical = await this.run(image, 'vertical', opts.region);
    return mergeRuns(horizontal, vertical);
  }

  async dispose(): Promise<void> {
    const all = [...this.workers.values()];
    this.workers.clear();
    await Promise.all(all.map((p) => p.then((w) => w.terminate()).catch(() => undefined)));
  }
}
