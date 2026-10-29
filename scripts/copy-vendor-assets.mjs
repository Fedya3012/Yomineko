// Copies the self-hosted helper files (OCR engine + models, RAR reader) into public/ so the app works
// fully offline and nothing is fetched from a CDN. Runs automatically before `dev` and `build`.
// public/ocr and public/vendor are generated, so they are git-ignored.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const nm = (...p) => join('node_modules', ...p);
const out = (...p) => join('public', ...p);
const need = (path) => { if (!existsSync(path)) throw new Error(`Thiếu ${path}. Hãy chạy "npm install" trước.`); return path; };

mkdirSync(out('ocr', 'core'), { recursive: true });
mkdirSync(out('ocr', 'lang'), { recursive: true });
mkdirSync(out('vendor', 'libarchive'), { recursive: true });

// tesseract.js worker + WebAssembly cores (LSTM only: the old engine is not needed for Japanese)
copyFileSync(need(nm('tesseract.js', 'dist', 'worker.min.js')), out('ocr', 'worker.min.js'));
for (const f of readdirSync(need(nm('tesseract.js-core')))) {
  if (/^tesseract-core.*lstm\.wasm\.js$/.test(f)) copyFileSync(nm('tesseract.js-core', f), out('ocr', 'core', f));
}
// Japanese models: horizontal (jpn) and vertical (jpn_vert), "best_int" = small and accurate
for (const lang of ['jpn', 'jpn_vert']) {
  const file = `${lang}.traineddata.gz`;
  copyFileSync(need(nm('@tesseract.js-data', lang, '4.0.0_best_int', file)), out('ocr', 'lang', file));
}
// RAR/CBR reader (libarchive compiled to WebAssembly)
for (const f of ['worker-bundle.js', 'libarchive.wasm']) copyFileSync(need(nm('libarchive.js', 'dist', f)), out('vendor', 'libarchive', f));
// PDF.js worker is imported through Vite (?url), nothing to copy.
console.log('Đã chép dữ liệu OCR và RAR vào public/');
