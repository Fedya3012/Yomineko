import { unzipSync } from 'fflate';
import { mimeForName, sortPageNames } from '../pages';
import type { PageRef } from '../types';

/** Open a ZIP/CBZ. Only the pages being read are decompressed, the rest stay packed in memory. */
export async function openCbz(file: Blob): Promise<PageRef[]> {
  const data = new Uint8Array(await file.arrayBuffer());
  const names: string[] = [];
  // A filter that always says "no" lists the entries without decompressing anything.
  unzipSync(data, { filter: (entry) => { names.push(entry.name); return false; } });
  return sortPageNames(names, (n) => n).map((name) => ({
    name,
    async load() {
      const files = unzipSync(data, { filter: (entry) => entry.name === name });
      return new Blob([files[name] as BlobPart], { type: mimeForName(name) });
    }
  }));
}
