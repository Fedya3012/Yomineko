import { describe, expect, it } from 'vitest';
import { detectFormat } from './formats';

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);

describe('detectFormat', () => {
  it('trusts the first bytes over the extension', () => {
    expect(detectFormat(bytes(0x50, 0x4b, 3, 4), 'book.cbr')).toBe('cbz'); // a ZIP named .cbr
    expect(detectFormat(bytes(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07), 'book.cbz')).toBe('cbr'); // a RAR named .cbz
    expect(detectFormat(bytes(0x25, 0x50, 0x44, 0x46), 'x.bin')).toBe('pdf');
  });
  it('falls back to the extension, then gives up', () => {
    expect(detectFormat(bytes(), 'a.cbz')).toBe('cbz');
    expect(detectFormat(bytes(), 'a.rar')).toBe('cbr');
    expect(detectFormat(bytes(), 'a.pdf')).toBe('pdf');
    expect(detectFormat(bytes(), 'a.docx')).toBe('unknown');
  });
});
