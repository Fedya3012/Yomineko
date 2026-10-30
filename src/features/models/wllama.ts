import type { ModelInfo } from './catalog';
import { stripThinking } from './webllm';

/** Marker address: llama.cpp runs inside the app (WebAssembly, CPU), nothing is sent anywhere. */
export const CPU_BASE_URL = 'llamacpp://device';

export interface CpuEngine {
  chat(messages: { role: 'system' | 'user' | 'assistant'; content: string }[]): Promise<string>;
  unload(): Promise<void>;
}
export type CpuEngineFactory = (url: string, onProgress: (fraction: number) => void) => Promise<CpuEngine>;

/** GGUF address of the model, or undefined when it has no in-app CPU build. */
export const cpuModelUrl = (m: ModelInfo): string | undefined => m.gguf?.url;

/**
 * Real engine: llama.cpp compiled to WebAssembly (wllama). It works in every WebView, including the
 * Android one that has no WebGPU. The .wasm is bundled with the app so only the model needs a download.
 */
export const defaultCpuFactory: CpuEngineFactory = async (url, onProgress) => {
  const [{ Wllama }, wasm] = await Promise.all([
    import('@wllama/wllama'),
    import('@wllama/wllama/esm/wasm/wllama.wasm?url')
  ]);
  const w = new Wllama({ default: wasm.default }, { allowOffline: true, suppressNativeLog: true });
  await w.loadModelFromUrl(url, {
    n_ctx: 2048,
    progressCallback: ({ loaded, total }) => onProgress(total ? loaded / total : 0)
  });
  return {
    async chat(messages) {
      const res = await w.createChatCompletion({ messages, max_tokens: 600, temperature: 0.7, chat_template_kwargs: { enable_thinking: false } });
      const c = res.choices[0]?.message?.content;
      return typeof c === 'string' ? c : '';
    },
    unload: () => w.exit()
  };
};

let factory: CpuEngineFactory = defaultCpuFactory;
let engine: CpuEngine | undefined;
let loadedUrl = '';
/** Tests swap the engine; production never calls this. */
export function setCpuEngineFactory(f: CpuEngineFactory) { factory = f; engine = undefined; loadedUrl = ''; }

export async function loadCpuModel(url: string, onProgress: (fraction: number) => void = () => {}): Promise<CpuEngine> {
  if (engine && loadedUrl === url) return engine;
  await engine?.unload().catch(() => {});
  engine = undefined; loadedUrl = '';
  engine = await factory(url, onProgress);
  loadedUrl = url;
  return engine;
}

export async function cpuChat(url: string, system: string, messages: { role: 'user' | 'assistant'; text: string }[]): Promise<string> {
  const e = await loadCpuModel(url);
  const text = stripThinking(await e.chat([{ role: 'system', content: system }, ...messages.map((m) => ({ role: m.role, content: m.text }))]));
  if (!text) throw new Error('AI trả về nội dung rỗng');
  return text;
}

/** wllama keeps downloaded models in its own cache; look the file up by URL. */
async function manager() {
  const { ModelManager } = await import('@wllama/wllama');
  return new ModelManager();
}

export async function isCpuModelCached(url: string): Promise<boolean> {
  try { return (await (await manager()).getModels()).some((m) => m.url === url); } catch { return false; }
}

export async function deleteCpuModel(url: string): Promise<void> {
  if (loadedUrl === url) { await engine?.unload().catch(() => {}); engine = undefined; loadedUrl = ''; }
  const m = (await (await manager()).getModels()).find((x) => x.url === url);
  await m?.remove();
}
