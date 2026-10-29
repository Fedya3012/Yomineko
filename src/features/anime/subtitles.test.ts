import { describe, expect, it } from 'vitest';
import { cueAt, parseSubtitles, parseTimestamp } from './subtitles';

const SRT = `﻿1
00:00:01,000 --> 00:00:03,500
<i>猫は本を読む。</i>

2
00:00:04,000 --> 00:00:06,000
こんにちは
元気ですか
`;

describe('subtitles', () => {
  it('parses timestamps in SRT and VTT styles', () => {
    expect(parseTimestamp('00:01:02,500')).toBeCloseTo(62.5);
    expect(parseTimestamp('01:02.250')).toBeCloseTo(62.25);
    expect(parseTimestamp('nope')).toBeNaN();
  });
  it('parses SRT, strips tags and BOM, keeps multi-line cues', () => {
    const cues = parseSubtitles(SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ index: 0, start: 1, end: 3.5, text: '猫は本を読む。' });
    expect(cues[1].text).toBe('こんにちは\n元気ですか');
  });
  it('parses WebVTT with header and cue settings', () => {
    const vtt = 'WEBVTT\n\nintro\n00:01.000 --> 00:02.000 align:start\nおはよう\n';
    expect(parseSubtitles(vtt)).toEqual([{ index: 0, start: 1, end: 2, text: 'おはよう' }]);
  });
  it('parses ASS and drops override tags', () => {
    const ass = `[Script Info]\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:05.00,0:00:07.50,Default,,0,0,0,,{\\i1}行こう、{\\i0}よ\\Nね\n`;
    const [c] = parseSubtitles(ass);
    expect(c).toMatchObject({ start: 5, end: 7.5, text: '行こう、よ\nね' });
  });
  it('finds the active cue by time', () => {
    const cues = parseSubtitles(SRT);
    expect(cueAt(cues, 0.5)).toBe(-1);
    expect(cueAt(cues, 2)).toBe(0);
    expect(cueAt(cues, 3.7)).toBe(-1);
    expect(cueAt(cues, 5)).toBe(1);
  });
});
