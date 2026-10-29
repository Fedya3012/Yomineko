import type { PageRef } from './types';

export interface LoadedPage { url: string; blob: Blob; width: number; height: number }

/** Browser hooks, injectable for tests. */
export interface PageIO {
  makeUrl(blob: Blob): string;
  revokeUrl(url: string): void;
  measure(blob: Blob): Promise<{ width: number; height: number }>;
}

export const browserIO: PageIO = {
  makeUrl: (b) => URL.createObjectURL(b),
  revokeUrl: (u) => URL.revokeObjectURL(u),
  async measure(blob) {
    const bmp = await createImageBitmap(blob);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  }
};

/**
 * Keeps only the pages near the reader in memory: a 300-page book would otherwise
 * hold hundreds of megabytes of decoded images.
 */
export class PageCache {
  private entries = new Map<number, Promise<LoadedPage>>();
  private ready = new Map<number, LoadedPage>();

  constructor(private pages: PageRef[], private io: PageIO = browserIO, private keep = 6) {}

  get(index: number): Promise<LoadedPage> {
    let p = this.entries.get(index);
    if (!p) {
      p = this.pages[index].load().then(async (blob) => {
        const { width, height } = await this.io.measure(blob);
        const page = { url: this.io.makeUrl(blob), blob, width, height };
        this.ready.set(index, page);
        return page;
      });
      p.catch(() => this.entries.delete(index)); // allow retry after a failure
      this.entries.set(index, p);
    }
    return p;
  }

  /** Drop everything further than `keep` pages away from `centre`. */
  trim(centre: number): void {
    for (const index of [...this.entries.keys()]) {
      if (Math.abs(index - centre) <= this.keep) continue;
      this.entries.delete(index);
      const page = this.ready.get(index);
      if (page) { this.io.revokeUrl(page.url); this.ready.delete(index); }
    }
  }

  dispose(): void {
    for (const page of this.ready.values()) this.io.revokeUrl(page.url);
    this.entries.clear();
    this.ready.clear();
  }
}
