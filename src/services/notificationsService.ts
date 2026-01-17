export const NOTIFICATIONS_API_URL = import.meta.env.VITE_GAS_NOTIFICATIONS_API_URL || "";

export function isNotificationsApiConfigured(): boolean {
  return Boolean(NOTIFICATIONS_API_URL);
}

export async function registerFcmTokenWithBackend(options: {
  fcmToken: string;
  userId?: string;
  userName?: string;
  role?: string;
  platform?: string;
  userAgent?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!NOTIFICATIONS_API_URL) {
    return { success: false, error: "Notifications API not configured" };
  }

  const response = await fetch(NOTIFICATIONS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "registerFcmToken",
      fcmToken: options.fcmToken,
      userId: options.userId || "",
      userName: options.userName || "",
      role: options.role || "",
      platform: options.platform || "",
      userAgent: options.userAgent || "",
    }),
  });

  return response.json();
}

export async function unregisterFcmTokenWithBackend(fcmToken: string) {
  if (!NOTIFICATIONS_API_URL) {
    return { success: false, error: "Notifications API not configured" };
  }

  const response = await fetch(NOTIFICATIONS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      action: "unregisterSubscription",
      fcmToken,
    }),
  });

  return response.json();
}
