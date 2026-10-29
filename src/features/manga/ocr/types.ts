import type { Box } from '../types';

export type { Box };
export type Orientation = 'vertical' | 'horizontal';

/** One recognised character with its box in PAGE-IMAGE pixels (so it scales with any zoom). */
export interface OcrChar { ch: string; box: Box; conf: number }

/** A speech bubble / caption: characters in reading order. */
export interface OcrBlock {
  id: number;
  box: Box;
  orientation: Orientation;
  chars: OcrChar[];
  /** chars joined; text[i] is chars[i].ch because every OcrChar holds exactly one UTF-16 unit. */
  text: string;
  conf: number;
}

/** The slice of tesseract.js output we read (kept structural so tests can build it by hand). */
export interface RawSymbol { text: string; confidence: number; bbox: Box }
export interface RawLine { bbox: Box; words: { symbols: RawSymbol[] }[] }
export interface RawParagraph { bbox: Box; confidence: number; lines: RawLine[] }
export interface RawBlock { paragraphs: RawParagraph[] }
