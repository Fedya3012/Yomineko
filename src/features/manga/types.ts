// Shared types for the manga reader. Nothing here depends on the DOM, so it is easy to unit-test.

export type BookFormat = 'cbz' | 'cbr' | 'pdf' | 'images';

export interface PageRef {
  /** File name inside the archive (for sorting and debugging). */
  name: string;
  /** Produce the page image. Called lazily, only for pages the reader is about to show. */
  load(): Promise<Blob>;
}

export interface Book {
  /** Stable id used to remember the reading position (same file => same id). */
  id: string;
  title: string;
  format: BookFormat;
  pages: PageRef[];
  /** Release memory/workers held by the source. */
  close(): void;
}

export interface Box { x0: number; y0: number; x1: number; y1: number }
