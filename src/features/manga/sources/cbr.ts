import { mimeForName, sortPageNames } from '../pages';
import type { PageRef } from '../types';

interface LibEntry { file: { extract?: () => Promise<File> } & Partial<File>; path: string }

/**
 * Open a RAR/CBR (also 7z) with libarchive compiled to WebAssembly (MIT, bundles BSD libarchive).
 * `workerUrl` points at the copy of worker-bundle.js that scripts/copy-vendor-assets.mjs places in public/.
 */
export async function openCbr(file: Blob, workerUrl: string): Promise<{ pages: PageRef[]; close(): void }> {
  const { Archive } = await import('libarchive.js');
  Archive.init({ workerUrl });
  const archive = await Archive.open(file instanceof File ? file : new File([file], 'book.cbr'));
  const entries = (await archive.getFilesArray()) as LibEntry[];
  const full = (e: LibEntry) => `${e.path ?? ''}${e.file.name ?? ''}`;
  const pages = sortPageNames(entries, full).map<PageRef>((e) => ({
    name: full(e),
    async load() {
      const f = e.file.extract ? await e.file.extract() : (e.file as File);
      return new Blob([f], { type: mimeForName(full(e)) });
    }
  }));
  return { pages, close: () => { void archive.close(); } };
}
