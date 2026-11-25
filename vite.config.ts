import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    ...(!process.env.VITEST
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'favicon.ico',
              'apple-touch-icon.png',
              'icon.svg',
              'icon-maskable.svg',
            ],
            manifest: {
              id: '/',
              name: 'SystemPulse Pro — Diagnostyka PC i Benchmarki 3D',
              short_name: 'SystemPulse',
              description:
                'Kompleksowy pakiet diagnostyki sprzętu PC i laptopa, benchmarki GPU 3D, CPU, RAM, dysków i analiza gier.',
              theme_color: '#070b14',
              background_color: '#070b14',
              display: 'standalone',
              start_url: '/',
              scope: '/',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/pwa-maskable-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
              globIgnores: ['**/portable-bundle.js', '**/portable-styles.css'],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'google-fonts-cache',
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
                {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'gstatic-fonts-cache',
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
              ],
            },
            devOptions: {
              enabled: true,
              type: 'module',
            },
          }),
        ]
      : []),
  ],
  build: {
    chunkSizeWarningLimit: 5000,
  },
});
