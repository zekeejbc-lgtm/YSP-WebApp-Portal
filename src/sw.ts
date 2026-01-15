/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const pageStrategy = new NetworkFirst({
  cacheName: 'pages',
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
    cacheName: 'gas-api',
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
    cacheName: 'gas-api',
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
    cacheName: 'google-fonts',
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
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);
