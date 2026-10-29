// Loose types so the converter can be unit-tested from TypeScript.
export const LICENSES: Record<'jmdict' | 'examples' | 'kanjidic', { name: string; url: string; attribution: string }>;
export function parseJlptCsv(text: string, level: number): { expression: string; reading: string; level: number }[];
export function buildJlptMap(rows: { expression: string; reading: string; level: number }[]): Map<string, number>;
export function convertWord(w: any, opts?: { jlpt?: Map<string, number>; rankOf?: (t: string) => number | undefined }): { word: any; examples: any[] };
export function convertKanji(c: any): any;
export function buildPacks(o: { jmdict?: any; kanjidic?: any; jlptRows?: any[]; freqWords?: string[]; version: number; commonOnly?: boolean }): Record<string, any>;
