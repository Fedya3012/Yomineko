import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

// BASE_PATH is set by GitHub Actions for the GitHub Pages build (e.g. "/Yomineko/").
// Desktop (Tauri) and Android (Capacitor) builds use the default "./".
const base = process.env.BASE_PATH ?? './';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    svelte(),
    VitePWA({
      // 'prompt': a new web version waits for the user (see UpdateCenter) instead of reloading mid-lesson
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Yomineko 読み猫',
        short_name: 'Yomineko',
        description: 'Học tiếng Nhật qua manga và anime',
        theme_color: '#fff7f3',
        background_color: '#fff7f3',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The OCR engine and Japanese models are ~20 MB: not downloaded with the app shell, but cached
        // the first time OCR / RAR / PDF is used, and then work offline.
        globIgnores: ['ocr/**', 'vendor/**', '**/webllm*'],
        runtimeCaching: [{
          urlPattern: ({ url }) => /\/(ocr|vendor)\/|pdf\.worker.*\.mjs$|\/webllm[^/]*\.js$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'yomineko-engines', expiration: { maxEntries: 40 }, cacheableResponse: { statuses: [0, 200] } }
        }]
      }
    })
  ],
  build: {
    // WebLLM is ~6 MB and only needed once the user runs a model inside the app: keep it in its own chunk.
    rollupOptions: { output: { manualChunks: (id) => (id.includes('@mlc-ai/web-llm') ? 'webllm-lib' : undefined) } }
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'] }
});
