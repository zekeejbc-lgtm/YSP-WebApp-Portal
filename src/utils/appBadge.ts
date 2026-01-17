const BADGE_KEY = "ysp-app-badge-count";

const getStoredBadgeCount = () => {
  const raw = localStorage.getItem(BADGE_KEY);
  const parsed = raw ? Number(raw) : 0;
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const applyBadgeCount = async (count: number) => {
  if (!("setAppBadge" in navigator) || typeof navigator.setAppBadge !== "function") {
    return;
  }

  if (count > 0) {
    await navigator.setAppBadge(count);
  } else if ("clearAppBadge" in navigator && typeof navigator.clearAppBadge === "function") {
    await navigator.clearAppBadge();
  }
};

export const setAppBadge = async (count: number) => {
  const safeCount = Math.max(0, Math.floor(count));
  localStorage.setItem(BADGE_KEY, String(safeCount));
  await applyBadgeCount(safeCount);
};

export const clearAppBadge = async () => {
  localStorage.setItem(BADGE_KEY, "0");
  await applyBadgeCount(0);
};

export const incrementAppBadge = async (amount = 1) => {
  const next = getStoredBadgeCount() + amount;
  await setAppBadge(next);
};
