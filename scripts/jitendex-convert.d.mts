// Loose types so the converter can be unit-tested from TypeScript.
export const JITENDEX_LICENSE: { name: string; url: string; attribution: string };
export function textOf(n: unknown): string;
export function sensesOfRow(row: unknown[]): any[];
export function convertRows(rows: unknown[][]): { id: string; senses: any[] }[];
export function buildJitendexPack(o: { rows: unknown[][]; version: number; title?: string }): any;
