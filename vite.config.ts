import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is set by GitHub Actions for the GitHub Pages build (e.g. "/Yomineko/").
// Desktop (Tauri) and Android (Capacitor) builds use the default "./".
const base = process.env.BASE_PATH ?? './';

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
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
      workbox: { globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'], maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 }
    })
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
