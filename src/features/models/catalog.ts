export type Fit = 'ok' | 'heavy' | 'no' | 'unknown';

export interface ModelInfo {
  id: string;
  name: string;
  /** Tag used by Ollama, the runtime that downloads and runs the model. */
  ollama: string;
  sizeGb: number;
  ramGb: number;
  japanese: string;
  license: string;
  /** Extra obligation the user should know about, if any. */
  licenseNote?: string;
  isDefault?: boolean;
  /** Builds that run inside the app via WebLLM (WebGPU). f16 is faster but needs the shader-f16 GPU feature. */
  web?: { f16: string; f32?: string; vramMb: number; note?: string };
  /** GGUF build for llama.cpp (WebAssembly, CPU) inside the app: used where WebGPU is missing, e.g. the Android WebView. Only small models: WebAssembly memory is capped near 4 GB. */
  gguf?: { url: string };
}

/**
 * Ordered light/weak to heavy/strong. Only models whose license allows distribution are listed
 * (Llama 3.2 is left out: its license needs "Built with Llama" and it does not support Japanese).
 * Sizes are Q4 builds. Qwen3 0.6B and 4B sizes are estimates, none measured on real devices yet.
 */
export const MODELS: ModelInfo[] = [
  { id: 'qwen3-0.6b', name: 'Qwen3 0.6B', ollama: 'qwen3:0.6b', sizeGb: 0.4, ramGb: 2, japanese: 'Hiểu cơ bản, hay sai khi giải thích ngữ pháp', license: 'Apache 2.0', web: { f16: 'Qwen3-0.6B-q4f16_1-MLC', f32: 'Qwen3-0.6B-q4f32_1-MLC', vramMb: 1403 }, gguf: { url: 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf' } },
  { id: 'gemma3-1b', name: 'Gemma 3 1B', ollama: 'gemma3:1b', sizeGb: 0.7, ramGb: 4, japanese: 'Chưa có đánh giá về tiếng Nhật', license: 'Điều khoản Gemma của Google', licenseNote: 'Có điều kiện: phải kèm điều khoản và giới hạn sử dụng của Google.', web: { f16: 'gemma3-1b-it-q4f16_1-MLC', vramMb: 711 }, gguf: { url: 'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf' } },
  { id: 'qwen3-1.7b', name: 'Qwen3 1.7B', ollama: 'qwen3:1.7b', sizeGb: 1.1, ramGb: 6, japanese: 'Khá, hợp để sửa câu và hỏi đáp ngắn', license: 'Apache 2.0', isDefault: true, web: { f16: 'Qwen3-1.7B-q4f16_1-MLC', f32: 'Qwen3-1.7B-q4f32_1-MLC', vramMb: 2037 }, gguf: { url: 'https://huggingface.co/unsloth/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf' } },
  { id: 'phi4-mini', name: 'Phi-4 Mini 3.8B', ollama: 'phi4-mini', sizeGb: 2.7, ramGb: 8, japanese: 'Có hỗ trợ tiếng Nhật nhưng không đều', license: 'MIT', web: { f16: 'Phi-4-mini-instruct-q4f16_1-MLC', f32: 'Phi-4-mini-instruct-q4f32_1-MLC', vramMb: 3438 } },
  { id: 'qwen3-4b', name: 'Qwen3 4B Instruct 2507', ollama: 'qwen3:4b-instruct-2507-q4_K_M', sizeGb: 2.5, ramGb: 8, japanese: 'Tốt nhất trong nhóm nhỏ: giải thích ngữ pháp, sửa câu, nhập vai', license: 'Apache 2.0', web: { f16: 'Qwen3-4B-q4f16_1-MLC', f32: 'Qwen3-4B-q4f32_1-MLC', vramMb: 3432, note: 'Bản Qwen3 4B thường, không phải bản Instruct 2507.' } },
  { id: 'gemma3-4b', name: 'Gemma 3 4B', ollama: 'gemma3:4b', sizeGb: 2.9, ramGb: 8, japanese: 'Tạm được', license: 'Điều khoản Gemma của Google', licenseNote: 'Có điều kiện: phải kèm điều khoản và giới hạn sử dụng của Google.' }
];

export const DEFAULT_MODEL = MODELS.find((m) => m.isDefault)!;

export const FIT_LABEL: Record<Fit, string> = {
  ok: 'Máy bạn chạy được',
  heavy: 'Hơi nặng',
  no: 'Không đủ RAM',
  unknown: 'Chưa rõ RAM máy'
};

/** Needs the full RAM figure to be "ok"; 60% of it still runs but slowly ("heavy"). */
export function fitFor(m: ModelInfo, deviceRamGb: number | undefined): Fit {
  if (!deviceRamGb || !Number.isFinite(deviceRamGb) || deviceRamGb <= 0) return 'unknown';
  if (deviceRamGb >= m.ramGb) return 'ok';
  if (deviceRamGb >= m.ramGb * 0.6) return 'heavy';
  return 'no';
}

/** The strongest model that still fits comfortably, for the "gợi ý cho máy bạn" hint. */
export function suggestFor(deviceRamGb: number | undefined): ModelInfo | undefined {
  return [...MODELS].reverse().find((m) => fitFor(m, deviceRamGb) === 'ok');
}

/** Browsers cap navigator.deviceMemory at 8 and only Chromium has it, so 8 means "8 or more". */
export function detectRamGb(nav: { deviceMemory?: number } | undefined = typeof navigator === 'undefined' ? undefined : (navigator as { deviceMemory?: number })): number | undefined {
  const v = nav?.deviceMemory;
  return typeof v === 'number' && v > 0 ? v : undefined;
}
