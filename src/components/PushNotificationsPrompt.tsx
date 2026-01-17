import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import Button from "./design-system/Button";
import { toast } from "sonner";
import { getStoredUser } from "../services/gasLoginService";
import { getFcmToken, isFirebaseConfigured, onForegroundMessage } from "../services/firebaseMessaging";
import { isNotificationsApiConfigured, registerFcmTokenWithBackend } from "../services/notificationsService";
import { incrementAppBadge } from "../utils/appBadge";

const DISMISS_KEY = "push-notifications-dismissed-at";
const ENABLED_KEY = "push-notifications-enabled";
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

const isPushSupported = () => {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
};

export default function PushNotificationsPrompt() {
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const rawDismissed = localStorage.getItem(DISMISS_KEY);
    const rawEnabled = localStorage.getItem(ENABLED_KEY);
    const parsedDismissed = rawDismissed ? Number(rawDismissed) : null;
    if (parsedDismissed && !Number.isNaN(parsedDismissed)) {
      setDismissedAt(parsedDismissed);
    }
    setIsEnabled(rawEnabled === "true");
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !isPushSupported()) return () => {};
    return onForegroundMessage((payload) => {
      const notification = (payload as { notification?: { title?: string; body?: string } }).notification;
      if (!notification) return;
      toast.info(notification.title || "New notification", {
        description: notification.body || "",
      });
      incrementAppBadge().catch(() => {});
    });
  }, []);

  const isDismissed = useMemo(() => {
    if (!dismissedAt) return false;
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  }, [dismissedAt]);

  const handleEnable = async () => {
    if (!isPushSupported()) {
      toast.error("Push notifications are not supported on this device.");
      return;
    }
    if (!isFirebaseConfigured()) {
      toast.error("Firebase configuration is missing.");
      return;
    }
    if (!isNotificationsApiConfigured()) {
      toast.error("Notifications API is not configured.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      const now = Date.now();
      localStorage.setItem(DISMISS_KEY, String(now));
      setDismissedAt(now);
      toast.warning("Notifications are disabled.");
      return;
    }

    const token = await getFcmToken();
    if (!token) {
      toast.error("Failed to get notification token.");
      return;
    }

    const user = getStoredUser();
    const result = await registerFcmTokenWithBackend({
      fcmToken: token,
      userId: user?.id,
      userName: user?.name,
      role: user?.role,
      platform: navigator.platform || "",
      userAgent: navigator.userAgent || "",
    });

    if (!result.success) {
      toast.error(result.error || "Failed to register notifications.");
      return;
    }

    localStorage.setItem(ENABLED_KEY, "true");
    setIsEnabled(true);
    toast.success("Notifications enabled.");
  };

  const handleDismiss = () => {
    const now = Date.now();
    localStorage.setItem(DISMISS_KEY, String(now));
    setDismissedAt(now);
  };

  if (!isPushSupported() || !isFirebaseConfigured()) return null;
  if (Notification.permission === "granted" || isEnabled || isDismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-orange-200 bg-white/95 p-4 shadow-xl backdrop-blur"
      role="dialog"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-full bg-orange-100 p-2 text-orange-600">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Enable notifications</p>
          <p className="text-xs text-gray-600">
            Get alerts about announcements and important updates.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Not now
            </Button>
            <Button variant="primary" size="sm" onClick={handleEnable} icon={<Bell className="h-4 w-4" />}>
              Enable
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
