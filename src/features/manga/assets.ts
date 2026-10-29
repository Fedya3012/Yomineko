// Where the self-hosted helper files live at runtime. Relative to the page so the same build
// works from a web server, from Tauri (.exe) and from Capacitor (APK).
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { OcrPaths } from './ocr/engine';
import type { Assets } from './open';

const abs = (path: string) => new URL(import.meta.env.BASE_URL + path, document.baseURI).href;

export const assets = (): Assets => ({
  libarchiveWorker: abs('vendor/libarchive/worker-bundle.js'),
  pdfWorker: new URL(pdfWorker, document.baseURI).href
});

export const ocrPaths = (): OcrPaths => ({
  workerPath: abs('ocr/worker.min.js'),
  corePath: abs('ocr/core'),
  langPath: abs('ocr/lang')
});
