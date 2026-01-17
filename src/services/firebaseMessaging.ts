const FIREBASE_SDK_VERSION = "10.13.2";

let firebaseApp: unknown | null = null;
let messaging: unknown | null = null;

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId
  );
}

async function loadFirebaseApp(): Promise<unknown | null> {
  if (!isFirebaseConfigured()) return null;
  if (firebaseApp) return firebaseApp;

  const { initializeApp } = await import(
    /* @vite-ignore */
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`
  );
  firebaseApp = initializeApp(getFirebaseConfig());
  return firebaseApp;
}

async function loadFirebaseMessaging(): Promise<{
  getMessaging: (app: unknown) => unknown;
  getToken: (messagingInstance: unknown, options: {
    vapidKey?: string;
    serviceWorkerRegistration?: ServiceWorkerRegistration;
  }) => Promise<string>;
  onMessage: (
    messagingInstance: unknown,
    callback: (payload: Record<string, unknown>) => void
  ) => () => void;
}> {
  return import(
    /* @vite-ignore */
    `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging.js`
  );
}

async function getFirebaseMessaging(): Promise<unknown | null> {
  if (messaging) return messaging;
  const app = await loadFirebaseApp();
  if (!app) return null;

  const { getMessaging } = await loadFirebaseMessaging();
  messaging = getMessaging(app);
  return messaging;
}

export async function getFcmToken(): Promise<string | null> {
  if (!("serviceWorker" in navigator)) return null;
  if (!("Notification" in window)) return null;
  if (!isFirebaseConfigured()) return null;
  if (!import.meta.env.VITE_FIREBASE_VAPID_KEY) return null;

  const registration = await navigator.serviceWorker.ready;
  const messagingInstance = await getFirebaseMessaging();
  if (!messagingInstance) return null;

  const { getToken } = await loadFirebaseMessaging();
  return getToken(messagingInstance, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

export function onForegroundMessage(
  callback: (payload: Record<string, unknown>) => void
): () => void {
  let unsubscribed = false;
  let unsubscribe = () => {};

  (async () => {
    const messagingInstance = await getFirebaseMessaging();
    if (!messagingInstance || unsubscribed) return;
    const { onMessage } = await loadFirebaseMessaging();
    unsubscribe = onMessage(messagingInstance, callback);
  })();

  return () => {
    unsubscribed = true;
    unsubscribe();
  };
}
