import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { HelmetProvider } from "react-helmet-async"; // <--- Imported here
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./App.tsx";
import { clearAppBadge } from "./utils/appBadge";
import { validateEnv } from "./utils/validateEnv";
import "./index.css";

// Validate environment variables before anything else
validateEnv();

if (import.meta.env.PROD) {
  const noop = () => {};
  const appConsole = globalThis.console;
  appConsole.log = noop;
  appConsole.info = noop;
  appConsole.warn = noop;
  appConsole.debug = noop;
}

// Wrapped App with HelmetProvider, ErrorBoundary, and BrowserRouter
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

createRoot(rootEl).render(
  <ErrorBoundary>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </ErrorBoundary>
);

let updateToastId: string | number | undefined;
let updateToastActive = false;
let shouldReloadOnControllerChange = false;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (updateToastActive) return;
    updateToastActive = true;
    updateToastId = toast.info("New version available", {
      description: "Refresh to update the app.",
      duration: 10000,
      action: {
        label: "Refresh",
        onClick: () => {
          shouldReloadOnControllerChange = true;
          updateSW(true);
          if (updateToastId !== undefined) {
            toast.dismiss(updateToastId);
          }
          updateToastActive = false;
        },
      },
    });
  },
  onOfflineReady() {
    toast.success("App ready for offline use.");
  },
});

let lastOfflineQueueToastAt = 0;
let lastOfflineSyncToastAt = 0;
const OFFLINE_QUEUE_TOAST_COOLDOWN_MS = 5000;
const OFFLINE_SYNC_TOAST_COOLDOWN_MS = 5000;

if ("serviceWorker" in navigator) {
  // Reload only when the user explicitly accepted an app update.
  // Avoids reloads on first SW install (which can happen around offline-ready toasts).
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!shouldReloadOnControllerChange || refreshing) return;
    refreshing = true;
    console.warn("New service worker controller detected, reloading...");
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as { type?: string; version?: string };
    if (!data) return;

    if (data.type === "OFFLINE_WRITE_QUEUED") {
      const now = Date.now();
      if (now - lastOfflineQueueToastAt < OFFLINE_QUEUE_TOAST_COOLDOWN_MS) return;
      lastOfflineQueueToastAt = now;

      toast.info("You're offline", {
        description: "Your changes are queued and will sync when you're online.",
        duration: 5000,
      });
    }

    if (data.type === "OFFLINE_QUEUE_SYNCED") {
      const now = Date.now();
      if (now - lastOfflineSyncToastAt < OFFLINE_SYNC_TOAST_COOLDOWN_MS) return;
      lastOfflineSyncToastAt = now;

      toast.success("Back online", {
        description: "Queued changes have been synced.",
        duration: 4000,
      });
    }
  });
}

const clearBadgeOnFocus = () => {
  clearAppBadge();
};

window.addEventListener("focus", clearBadgeOnFocus);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    clearBadgeOnFocus();
  }
});
clearBadgeOnFocus();
