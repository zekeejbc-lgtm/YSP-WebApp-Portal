/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v2-icon-padding';
const CACHE_NAMES = {
  pages: `pages-${CACHE_VERSION}`,
  gasApi: `gas-api-${CACHE_VERSION}`,
  googleFonts: `google-fonts-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
};

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('pages-') || key.startsWith('gas-api-') || key.startsWith('google-fonts-') || key.startsWith('images-'))
          .filter((key) => !Object.values(CACHE_NAMES).includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
});

const pageStrategy = new NetworkFirst({
  cacheName: CACHE_NAMES.pages,
  networkTimeoutSeconds: 5,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 30,
      maxAgeSeconds: 60 * 60 * 24 * 7,
    }),
  ],
});

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ request, event }) => {
    try {
      const response = await pageStrategy.handle({ request, event });
      if (response) return response;
    } catch {
      // Fall through to cached app shell or offline page.
    }

    const appShell = await caches.match('/index.html', { ignoreSearch: true });
    if (appShell) return appShell;

    const offline = await caches.match('/offline.html', { ignoreSearch: true });
    return offline || Response.error();
  }
);

registerRoute(
  /^https:\/\/script\.google\.com\/macros\/s\//,
  new NetworkFirst({
    cacheName: CACHE_NAMES.gasApi,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);

registerRoute(
  /^https:\/\/script\.googleusercontent\.com\//,
  new NetworkFirst({
    cacheName: CACHE_NAMES.gasApi,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);

registerRoute(
  /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.googleFonts,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: CACHE_NAMES.images,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);
