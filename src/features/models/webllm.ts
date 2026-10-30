import type { ModelInfo } from './catalog';

/** Marker address: the model runs inside the app, nothing is sent anywhere. */
export const WEB_BASE_URL = 'webllm://device';

export interface WebChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface WebEngine {
  chat: { completions: { create(req: Record<string, unknown>): Promise<{ choices: { message: { content: string | null } }[] }> } };
  unload(): Promise<void>;
}
export type EngineFactory = (modelId: string, onProgress: (fraction: number, text: string) => void) => Promise<WebEngine>;

export const supportsWebGpu = (nav: { gpu?: unknown } | undefined = typeof navigator === 'undefined' ? undefined : (navigator as { gpu?: unknown })) => !!nav?.gpu;

/** f16 builds are smaller and faster, but only run when the GPU exposes shader-f16. */
export async function hasShaderF16(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<{ features: Set<string> } | null> } }).gpu;
    return !!(await gpu?.requestAdapter())?.features.has('shader-f16');
  } catch { return false; }
}

/** Picks the build id for this GPU, or undefined when the model has no in-app build. */
export function webModelId(m: ModelInfo, f16: boolean): string | undefined {
  if (!m.web) return undefined;
  return f16 ? m.web.f16 : m.web.f32;
}

/** Real engine: loads WebLLM only when first needed and runs it in a worker so the UI stays responsive. */
export const defaultFactory: EngineFactory = async (modelId, onProgress) => {
  const web = await import('@mlc-ai/web-llm');
  const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
  return web.CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback: (r) => onProgress(r.progress, r.text) }) as unknown as Promise<WebEngine>;
};

let factory: EngineFactory = defaultFactory;
let engine: WebEngine | undefined;
let loadedId = '';
/** Tests swap the engine; production never calls this. */
export function setEngineFactory(f: EngineFactory) { factory = f; engine = undefined; loadedId = ''; }

export async function loadWebModel(modelId: string, onProgress: (fraction: number, text: string) => void = () => {}): Promise<WebEngine> {
  if (engine && loadedId === modelId) return engine;
  await engine?.unload().catch(() => {});
  engine = undefined; loadedId = '';
  engine = await factory(modelId, onProgress);
  loadedId = modelId;
  return engine;
}

/** Qwen3 may print its reasoning inside <think> tags; learners should only see the answer. */
export const stripThinking = (t: string) => t.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();

export async function webChat(modelId: string, system: string, messages: { role: 'user' | 'assistant'; text: string }[]): Promise<string> {
  const e = await loadWebModel(modelId);
  const res = await e.chat.completions.create({
    messages: [{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.text }))],
    max_tokens: 600, extra_body: { enable_thinking: false }
  });
  const text = stripThinking(res.choices[0]?.message?.content ?? '');
  if (!text) throw new Error('AI trả về nội dung rỗng');
  return text;
}

export async function isWebModelCached(modelId: string): Promise<boolean> {
  try { return await (await import('@mlc-ai/web-llm')).hasModelInCache(modelId); } catch { return false; }
}

export async function deleteWebModel(modelId: string): Promise<void> {
  if (loadedId === modelId) { await engine?.unload().catch(() => {}); engine = undefined; loadedId = ''; }
  await (await import('@mlc-ai/web-llm')).deleteModelAllInfoInCache(modelId);
}
