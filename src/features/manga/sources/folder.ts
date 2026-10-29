import { isPageName, sortPageNames } from '../pages';
import type { PageRef } from '../types';

const pathOf = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;

/** Pages from a folder (or a hand-picked set of images). The files are already on disk, so loading is free. */
export function pagesFromFiles(files: File[]): { pages: PageRef[]; title: string } {
  const images = sortPageNames(files, pathOf);
  const first = images[0] ? pathOf(images[0]) : '';
  const title = first.includes('/') ? first.split('/')[0] : 'Ảnh đã chọn';
  return { pages: images.map((f) => ({ name: pathOf(f), load: async () => f })), title };
}

export const hasImages = (files: File[]) => files.some((f) => isPageName(pathOf(f)));

/** Flatten a drag-and-dropped folder tree (the browser only hands over the top level). */
export async function filesFromDrop(items: DataTransferItemList): Promise<File[]> {
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((ok, fail) => (entry as FileSystemFileEntry).file(ok, fail));
      Object.defineProperty(file, 'webkitRelativePath', { value: prefix + file.name });
      out.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        // readEntries returns results in batches; keep calling until it returns an empty batch.
        const batch = await new Promise<FileSystemEntry[]>((ok, fail) => reader.readEntries(ok, fail));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  const entries = [...items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  for (const e of entries) await walk(e, '');
  return out;
}
