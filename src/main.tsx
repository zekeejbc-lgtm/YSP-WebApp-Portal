
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { clearAppBadge } from "./utils/appBadge";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <PwaInstallPrompt />
  </>
);

let updateToastId: string | number | undefined;
let updateToastActive = false;

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
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as { type?: string };
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

  
