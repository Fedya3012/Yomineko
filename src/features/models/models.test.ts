import { describe, it, expect } from 'vitest';
import { DEFAULT_MODEL, MODELS, detectRamGb, fitFor, suggestFor } from './catalog';
import { deleteModel, isInstalled, listInstalled, pullModel } from './ollama';

const enc = (s: string) => new TextEncoder().encode(s);
const streamRes = (chunks: string[]) =>
  new Response(new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(enc(x))); c.close(); } }), { status: 200 });

describe('catalog', () => {
  it('is ordered light to heavy and defaults to Qwen3 1.7B', () => {
    const rams = MODELS.map((m) => m.ramGb);
    expect(rams).toEqual([...rams].sort((a, b) => a - b));
    expect(DEFAULT_MODEL.name).toBe('Qwen3 1.7B');
    expect(MODELS.filter((m) => m.isDefault)).toHaveLength(1);
  });
  it('labels fit by device RAM', () => {
    const q = MODELS.find((m) => m.id === 'qwen3-1.7b')!;
    expect(fitFor(q, 8)).toBe('ok');
    expect(fitFor(q, 6)).toBe('ok');
    expect(fitFor(q, 4)).toBe('heavy');
    expect(fitFor(q, 2)).toBe('no');
    expect(fitFor(q, undefined)).toBe('unknown');
  });
  it('suggests the strongest comfortable model', () => {
    expect(suggestFor(2)?.id).toBe('qwen3-0.6b');
    expect(suggestFor(1)).toBeUndefined();
    expect(suggestFor(8)?.id).toBe('gemma3-4b');
  });
  it('reads deviceMemory when present', () => {
    expect(detectRamGb({ deviceMemory: 4 })).toBe(4);
    expect(detectRamGb({})).toBeUndefined();
  });
});

describe('ollama client', () => {
  it('lists installed tags and matches :latest', async () => {
    const f = async () => new Response(JSON.stringify({ models: [{ name: 'qwen3:1.7b' }, { name: 'phi4-mini:latest' }] }));
    const tags = await listInstalled('http://localhost:11434/v1', f);
    expect(tags).toEqual(['qwen3:1.7b', 'phi4-mini:latest']);
    expect(isInstalled(tags, 'phi4-mini')).toBe(true);
    expect(isInstalled(tags, 'gemma3:1b')).toBe(false);
  });
  it('streams pull progress across split chunks', async () => {
    let url = '';
    const f = async (u: string) => { url = u; return streamRes(['{"status":"pulling","total":100,"comple', 'ted":40}\n{"status":"success"}\n']); };
    const seen: number[] = [];
    await pullModel('http://localhost:11434/v1', 'qwen3:1.7b', (p) => seen.push(p.done), f);
    expect(url).toBe('http://localhost:11434/api/pull');
    expect(seen).toEqual([40, 0]);
  });
  it('surfaces pull errors and delete failures', async () => {
    await expect(pullModel('http://x', 't', () => {}, async () => streamRes(['{"error":"not found"}\n']))).rejects.toThrow('not found');
    await expect(deleteModel('http://x', 't', async () => new Response('', { status: 404 }))).rejects.toThrow('404');
  });
});
