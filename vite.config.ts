import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: [
          'offline.html',
          'icons/pwa-192x192.png',
          'icons/pwa-512x512.png',
          'icons/maskable-512x512.png',
          'icons/apple-touch-icon.png',
          'screenshots/*.png',
          'splash/*.png',
        ],
        manifest: {
          name: `Youth Service Philippines - ${env.VITE_CHAPTER_NAME || 'Tagum Chapter'}`,
          short_name: env.VITE_SHORT_NAME || 'YSP Tagum',
          description: env.VITE_ORG_MOTTO || 'Shaping the Future to a Greater Society',
          id: '/',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui', 'browser'],
          orientation: 'portrait',
          theme_color: env.VITE_THEME_COLOR || '#f6421f',
          background_color: '#f8fafc',
          lang: 'en',
          categories: ['education', 'non-profit', 'community'],
          launch_handler: {
            client_mode: ['navigate-existing', 'auto'],
          },
          icons: [
            { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          screenshots: [
            { src: '/screenshots/home-portrait.png', sizes: '750x1334', type: 'image/png', form_factor: 'narrow', label: 'Homepage and updates' },
            { src: '/screenshots/home-landscape.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide', label: 'Desktop overview' },
          ],
          shortcuts: [
            { name: 'About YSP', short_name: 'About', description: 'Jump to the About section', url: '/#about', icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
            { name: 'Projects', short_name: 'Projects', description: 'View recent projects', url: '/#projects', icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
            { name: 'Contact', short_name: 'Contact', description: `Get in touch with ${env.VITE_SHORT_NAME || 'YSP Tagum'}`, url: '/#contact', icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' }] },
          ],
          share_target: {
            action: '/?share=1',
            method: 'GET',
            params: { title: 'title', text: 'text', url: 'url' },
          },
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src'), '@shared': path.resolve(__dirname, './gas-backend/shared') },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('jspdf')) return 'vendor-pdf';
              if (id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('html5-qrcode') || id.includes('jsqr')) return 'vendor-qr';
              return 'vendor';
            }
          },
        },
      },
    },
  };
});