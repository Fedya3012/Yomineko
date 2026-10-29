// Deciding which entries of an archive/folder are manga pages, and putting them in reading order.
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function isPageName(path: string): boolean {
  const parts = path.split(/[\\/]/);
  const base = parts[parts.length - 1];
  if (!base || base.startsWith('.')) return false; // .DS_Store, ._file (macOS resource forks)
  if (parts.includes('__MACOSX')) return false;
  return IMAGE_EXT.test(base);
}

/** "page2" < "page10" (natural order), folders first-class: "ch1/002" < "ch2/001". */
export function comparePageNames(a: string, b: string): number {
  return collator.compare(a, b);
}

export function sortPageNames<T>(items: T[], nameOf: (item: T) => string): T[] {
  return items.filter((i) => isPageName(nameOf(i))).sort((a, b) => comparePageNames(nameOf(a), nameOf(b)));
}

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp'
};
export function mimeForName(name: string): string {
  return MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/** FNV-1a hash -> short id, so the same book reopens at the same page. */
export function bookIdFor(title: string, size: number, pageCount: number): string {
  let h = 0x811c9dc5;
  for (const ch of `${title}|${size}|${pageCount}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
