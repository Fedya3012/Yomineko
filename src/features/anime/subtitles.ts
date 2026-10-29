// Subtitle parsing (SRT, WebVTT, ASS/SSA) into plain cues. Everything runs locally on text the user supplies.
export interface Cue { index: number; start: number; end: number; text: string }

/** "00:01:02,500" / "01:02.500" / "0:01:02.50" -> seconds. */
export function parseTimestamp(raw: string): number {
  const m = raw.trim().replace(',', '.').match(/^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/);
  if (!m) return NaN;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Remove formatting that is not part of the spoken text (HTML-ish tags, ASS override blocks, entities). */
export function cleanCueText(s: string): string {
  return s
    .replace(/\{[^}]*\}/g, '')
    .replace(/<rt>[^<]*<\/rt>/gi, '')   // ruby readings baked into the subtitle
    .replace(/<[^>]+>/g, '')
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

function parseBlocks(text: string, arrow: RegExp): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n');
    const at = lines.findIndex((l) => arrow.test(l));
    if (at < 0) continue;
    const [a, b] = lines[at].split('-->');
    const start = parseTimestamp(a);
    const end = parseTimestamp(b.trim().split(/\s+/)[0]);
    const body = cleanCueText(lines.slice(at + 1).join('\n'));
    if (Number.isNaN(start) || Number.isNaN(end) || !body) continue;
    cues.push({ index: 0, start, end, text: body });
  }
  return cues;
}

function parseAss(text: string): Cue[] {
  const cues: Cue[] = [];
  let fields: string[] = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
  for (const line of text.split('\n')) {
    if (/^Format:/i.test(line) && fields.includes('text') && /start/i.test(line)) {
      fields = line.slice(7).split(',').map((f) => f.trim().toLowerCase());
    } else if (/^Dialogue:/i.test(line)) {
      const parts = line.slice(9).split(',');
      const cut = fields.length - 1;
      const row = [...parts.slice(0, cut), parts.slice(cut).join(',')];
      const start = parseTimestamp(row[fields.indexOf('start')]);
      const end = parseTimestamp(row[fields.indexOf('end')]);
      const body = cleanCueText(row[fields.indexOf('text')] ?? '');
      if (!Number.isNaN(start) && !Number.isNaN(end) && body) cues.push({ index: 0, start, end, text: body });
    }
  }
  return cues;
}

export function parseSubtitles(input: string): Cue[] {
  const text = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const cues = /^\[Script Info\]/im.test(text) || /^Dialogue:/m.test(text)
    ? parseAss(text)
    : parseBlocks(text, /-->/);
  cues.sort((x, y) => x.start - y.start);
  return cues.map((c, i) => ({ ...c, index: i }));
}

/** Index of the cue showing at time `t`, or -1. Binary search over cues sorted by start. */
export function cueAt(cues: Cue[], t: number): number {
  let lo = 0, hi = cues.length - 1, best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  // Overlapping cues: look back a few for one that is still active.
  for (let i = best; i >= 0 && i > best - 4; i--) if (t < cues[i].end) return i;
  return -1;
}
