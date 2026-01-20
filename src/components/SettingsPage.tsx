import { useEffect, useMemo, useState } from "react";
import { Bell, Moon, Sun, Trash2 } from "lucide-react";
import { Button, PageLayout, DESIGN_TOKENS } from "./design-system";
// Use a local toggle to avoid relying on theme variables that are not defined globally.
import { getStoredUser } from "../services/gasLoginService";
import { getFcmToken, isFirebaseConfigured } from "../services/firebaseMessaging";
import {
  isNotificationsApiConfigured,
  registerFcmTokenWithBackend,
  unregisterFcmTokenWithBackend,
} from "../services/notificationsService";
import { type UploadToastMessage } from "./UploadToast";

interface SettingsPageProps {
  onClose: () => void;
  isDark: boolean;
  onToggleDark: () => void;
  onRequestCacheClear: () => void;
  addUploadToast: (message: UploadToastMessage) => void;
  updateUploadToast: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast: (id: string) => void;
}

const NOTIFICATIONS_ENABLED_KEY = "push-notifications-enabled";

const isPushSupported = () => {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
};

export default function SettingsPage({
  onClose,
  isDark,
  onToggleDark,
  onRequestCacheClear,
  addUploadToast,
  updateUploadToast,
  removeUploadToast,
}: SettingsPageProps) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isProcessingNotifications, setIsProcessingNotifications] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    setNotificationsEnabled(saved === "true");
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const notificationsStatus = useMemo(() => {
    if (!isPushSupported()) return "Push notifications are not supported on this device.";
    if (!isFirebaseConfigured()) return "Firebase is not configured.";
    if (!isNotificationsApiConfigured()) return "Notifications API is not configured.";
    if (permission === "denied") return "Notifications are blocked in browser settings.";
    if (notificationsEnabled) return "Notifications are enabled for this device.";
    return "Notifications are currently disabled.";
  }, [notificationsEnabled, permission]);

  const canToggleNotifications = useMemo(() => {
    return (
      isPushSupported() &&
      isFirebaseConfigured() &&
      isNotificationsApiConfigured() &&
      permission !== "denied" &&
      !isProcessingNotifications
    );
  }, [permission, isProcessingNotifications]);

  const handleEnableNotifications = async () => {
    const toastId = `notifications-enable-${Date.now()}`;
    addUploadToast({
      id: toastId,
      title: "Notifications",
      message: "Requesting permission...",
      status: "loading",
      progress: 20,
      progressLabel: "Checking permission",
    });

    try {
      if (!isPushSupported()) {
        updateUploadToast(toastId, {
          status: "error",
          progress: 100,
          title: "Unsupported",
          message: "Push notifications are not supported on this device.",
        });
        setTimeout(() => removeUploadToast(toastId), 4000);
        return;
      }

      if (!isFirebaseConfigured() || !isNotificationsApiConfigured()) {
        updateUploadToast(toastId, {
          status: "error",
          progress: 100,
          title: "Configuration Missing",
          message: "Firebase or Notifications API is not configured.",
        });
        setTimeout(() => removeUploadToast(toastId), 4000);
        return;
      }

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== "granted") {
        updateUploadToast(toastId, {
          status: "info",
          progress: 100,
          title: "Permission Denied",
          message: "Notifications were not enabled.",
        });
        setTimeout(() => removeUploadToast(toastId), 4000);
        return;
      }

      updateUploadToast(toastId, {
        progress: 60,
        message: "Registering device token...",
        progressLabel: "Registering",
      });

      const token = await getFcmToken();
      if (!token) {
        updateUploadToast(toastId, {
          status: "error",
          progress: 100,
          title: "Token Error",
          message: "Unable to retrieve notification token.",
        });
        setTimeout(() => removeUploadToast(toastId), 4000);
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
        updateUploadToast(toastId, {
          status: "error",
          progress: 100,
          title: "Registration Failed",
          message: result.error || "Unable to register notification token.",
        });
        setTimeout(() => removeUploadToast(toastId), 4000);
        return;
      }

      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "true");
      setNotificationsEnabled(true);
      updateUploadToast(toastId, {
        status: "success",
        progress: 100,
        title: "Notifications Enabled",
        message: "You will receive important updates.",
      });
      setTimeout(() => removeUploadToast(toastId), 3000);
    } finally {
      setIsProcessingNotifications(false);
    }
  };

  const handleDisableNotifications = async () => {
    const toastId = `notifications-disable-${Date.now()}`;
    addUploadToast({
      id: toastId,
      title: "Notifications",
      message: "Disabling notifications...",
      status: "loading",
      progress: 30,
      progressLabel: "Removing token",
    });

    try {
      if (permission === "granted") {
        const token = await getFcmToken();
        if (token) {
          await unregisterFcmTokenWithBackend(token);
        }
      }

      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, "false");
      setNotificationsEnabled(false);
      updateUploadToast(toastId, {
        status: "success",
        progress: 100,
        title: "Notifications Disabled",
        message: "You will no longer receive push alerts.",
      });
      setTimeout(() => removeUploadToast(toastId), 3000);
    } finally {
      setIsProcessingNotifications(false);
    }
  };

  const handleNotificationToggle = async (nextValue: boolean) => {
    if (isProcessingNotifications) return;
    setIsProcessingNotifications(true);
    if (nextValue) {
      await handleEnableNotifications();
    } else {
      await handleDisableNotifications();
    }
  };

  const SettingsToggle = ({
    checked,
    disabled,
    onChange,
  }: {
    checked: boolean;
    disabled?: boolean;
    onChange: (nextValue: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled ? "true" : "false"}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={[
        "relative inline-flex h-5 w-10 items-center rounded-full border transition-colors",
        checked ? "bg-orange-500 border-orange-500" : "bg-gray-300 border-gray-300",
        "dark:border-gray-600 dark:bg-gray-700",
        checked ? "dark:bg-orange-500 dark:border-orange-500" : "",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          "dark:bg-gray-100",
        ].join(" ")}
        style={{
          transform: checked ? "translateX(1.25rem)" : "translateX(0.25rem)",
        }}
      />
    </button>
  );

  return (
    <PageLayout
      title="Settings"
      subtitle="Manage notifications and appearance"
      isDark={isDark}
      onClose={onClose}
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-900 shadow-xl p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-orange-100 text-orange-600 p-2">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3
                  className="text-sm font-semibold text-gray-900 dark:text-gray-100"
                  style={{ fontFamily: DESIGN_TOKENS.typography.fontFamily.headings }}
                >
                  Notifications
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Receive announcements and important system updates.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {notificationsEnabled ? "On" : "Off"}
              </span>
              <SettingsToggle
                checked={notificationsEnabled}
                onChange={handleNotificationToggle}
                disabled={!canToggleNotifications}
              />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
            {notificationsStatus}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 p-2">
                {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div>
                <h3
                  className="text-sm font-semibold text-gray-900 dark:text-gray-100"
                  style={{ fontFamily: DESIGN_TOKENS.typography.fontFamily.headings }}
                >
                  Theme
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Switch between light and dark mode.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isDark ? "Dark" : "Light"}
              </span>
              <SettingsToggle
                checked={isDark}
                onChange={(checked) => {
                  if (checked !== isDark) {
                    onToggleDark();
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-200 p-2">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3
                  className="text-sm font-semibold text-gray-900 dark:text-gray-100"
                  style={{ fontFamily: DESIGN_TOKENS.typography.fontFamily.headings }}
                >
                  Clear Cache
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Remove stored app data on this device and do a hard refresh.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={onRequestCacheClear}>
                Clear Cache
              </Button>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
            This clears local storage, cached files, and saved app data for this device.
          </div>
        </div>
      </div>

    </PageLayout>
  );
}
