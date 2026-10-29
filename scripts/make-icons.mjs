// Renders public/favicon.svg into PNG icons (PWA + Tauri/Capacitor source). Run: npm run icons
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const browser = await chromium.launch();
for (const [size, out] of [[192, 'public/icon-192.png'], [512, 'public/icon-512.png'], [1024, 'icon-source.png']]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace('<svg', `<svg width="${size}" height="${size}"`)}</body>`);
  writeFileSync(out, await page.screenshot({ omitBackground: true }));
}
await browser.close();
