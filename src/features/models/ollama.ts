import type { FetchLike } from '../assistant/ai';

export interface PullProgress { status: string; done: number; total: number }

const base = (baseUrl: string) => baseUrl.replace(/\/v1\/?$/, '').replace(/\/+$/, '');

/** Tags of the models Ollama already has on this machine. Throws if Ollama is not running. */
export async function listInstalled(baseUrl: string, fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<string[]> {
  const res = await fetchFn(`${base(baseUrl)}/api/tags`, { method: 'GET' });
  if (!res.ok) throw new Error(`Ollama trả lỗi ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.models) ? json.models.map((m: { name?: string }) => String(m.name ?? '')).filter(Boolean) : [];
}

/** Streams a download. Ollama sends one JSON object per line. */
export async function pullModel(
  baseUrl: string, tag: string, onProgress: (p: PullProgress) => void,
  fetchFn: FetchLike = (u, i) => fetch(u, i), signal?: AbortSignal
): Promise<void> {
  const res = await fetchFn(`${base(baseUrl)}/api/pull`, {
    method: 'POST', signal, headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: tag, stream: true })
  });
  if (!res.ok || !res.body) throw new Error(`Ollama trả lỗi ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const handle = (line: string) => {
    if (!line.trim()) return;
    const j = JSON.parse(line);
    if (j.error) throw new Error(String(j.error));
    onProgress({ status: String(j.status ?? ''), done: Number(j.completed ?? 0), total: Number(j.total ?? 0) });
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    lines.forEach(handle);
  }
  handle(buf);
}

export async function deleteModel(baseUrl: string, tag: string, fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<void> {
  const res = await fetchFn(`${base(baseUrl)}/api/delete`, {
    method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: tag })
  });
  if (!res.ok) throw new Error(`Ollama trả lỗi ${res.status}`);
}

/** Ollama may list "qwen3:1.7b" or add ":latest"; compare tolerantly. */
export const isInstalled = (installed: string[], tag: string) =>
  installed.some((t) => t === tag || t === `${tag}:latest`);
