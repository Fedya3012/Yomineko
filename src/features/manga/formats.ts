import type { BookFormat } from './types';

/**
 * Work out what a file really is from its first bytes, not its extension:
 * many ".cbr" files are secretly ZIPs and many ".cbz" files are secretly RARs.
 */
export function detectFormat(head: Uint8Array, fileName: string): BookFormat | 'unknown' {
  const startsWith = (sig: number[]) => sig.every((b, i) => head[i] === b);
  if (startsWith([0x50, 0x4b, 0x03, 0x04]) || startsWith([0x50, 0x4b, 0x05, 0x06])) return 'cbz'; // PK..
  if (startsWith([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return 'cbr'; // Rar!\x1a\x07 (RAR4 and RAR5)
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return 'pdf'; // %PDF
  if (startsWith([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return 'cbr'; // 7z (libarchive reads it too)
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'cbz' || ext === 'zip') return 'cbz';
  if (ext === 'cbr' || ext === 'rar' || ext === 'cb7' || ext === '7z') return 'cbr';
  if (ext === 'pdf') return 'pdf';
  return 'unknown';
}
