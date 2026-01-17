/// <reference lib="webworker" />

import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'v2-icon-padding';
const CACHE_NAMES = {
  pages: `pages-${CACHE_VERSION}`,
  gasApi: `gas-api-${CACHE_VERSION}`,
  googleFonts: `google-fonts-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
};

const notifyClients = async (message: { type: string; [key: string]: unknown }) => {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
};

const gasApiBackgroundSync = new BackgroundSyncPlugin('gas-api-queue', {
  maxRetentionTime: 24 * 60,
  onSync: async ({ queue }) => {
    try {
      await queue.replayRequests();
      await notifyClients({ type: 'OFFLINE_QUEUE_SYNCED' });
    } catch (error) {
      throw error;
    }
  },
});

const notifyOnFailedWritePlugin = {
  fetchDidFail: async ({ request }: { request: Request }) => {
    await notifyClients({
      type: 'OFFLINE_WRITE_QUEUED',
      url: request.url,
      method: request.method,
    });
  },
};

const isBackgroundSyncCandidate = (request: Request, url: URL) => {
  if (request.method === 'GET') return false;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) return false;
  const action = url.searchParams.get('action')?.toLowerCase();
  if (action && action.includes('upload')) return false;
  if (url.pathname.toLowerCase().includes('upload')) return false;
  if (url.origin === 'https://script.google.com' || url.origin === 'https://script.googleusercontent.com') {
    return true;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return true;
  }
  return false;
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
  ({ request, url }) => isBackgroundSyncCandidate(request, url),
  new NetworkOnly({
    plugins: [gasApiBackgroundSync, notifyOnFailedWritePlugin],
  })
);

registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    (url.origin === 'https://script.google.com' || url.origin === 'https://script.googleusercontent.com'),
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

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const FIREBASE_SDK_VERSION = '10.13.2';

const initFirebaseMessaging = async () => {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.messagingSenderId) return;

  const { initializeApp } = await import(
    /* @vite-ignore */
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`
  );
  const { getMessaging, onBackgroundMessage } = await import(
    /* @vite-ignore */
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-sw.js`
  );

  const firebaseApp = initializeApp(firebaseConfig);
  const messaging = getMessaging(firebaseApp);

  onBackgroundMessage(messaging, async (payload) => {
    const notification = payload.notification || {};
    const title = notification.title || 'YSP Tagum';
    const url = notification.click_action || (payload.data && (payload.data.url || payload.data.link)) || '/';

    self.registration.showNotification(title, {
      body: notification.body || '',
      icon: notification.icon || '/icons/pwa-192x192.png',
      image: notification.image || undefined,
      data: { url },
    });

    if ('setAppBadge' in self.registration) {
      try {
        await self.registration.setAppBadge(1);
      } catch {
        // Ignore badge failures on unsupported browsers.
      }
    }
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data && event.notification.data.url;
    if ('clearAppBadge' in self.registration) {
      try {
        self.registration.clearAppBadge();
      } catch {
        // Ignore badge failures on unsupported browsers.
      }
    }
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl || '/');
        }
        return undefined;
      })
    );
  });
};

initFirebaseMessaging().catch(() => {
  // Ignore background init failures.
});
