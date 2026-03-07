import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import Button from "./design-system/Button";
import { secureGetItem, secureSetItem } from "../utils/secureStorage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const SEEN_KEY = "pwa-install-seen";
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

const isAppInstalled = () => {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return Boolean((navigator as { standalone?: boolean }).standalone);
};

const isIosDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function PwaInstallPrompt({
  enabled = true,
  delayMs = 0,
}: {
  enabled?: boolean;
  delayMs?: number;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [hasSeen, setHasSeen] = useState(false);
  const [isReady, setIsReady] = useState(delayMs === 0);
  const hasRecordedSeen = useRef(false);
  const [mountedAt, setMountedAt] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMountedAt(Date.now());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(isAppInstalled());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIos(isIosDevice());

    const onBeforeInstall = (event: Event) => {
      const rawDismissed = secureGetItem(DISMISS_KEY, { persistent: true });
      const dismissedAtValue = rawDismissed ? Number(rawDismissed) : NaN;
      const dismissedRecently =
        !Number.isNaN(dismissedAtValue) && Date.now() - dismissedAtValue < DISMISS_DURATION_MS;
      const seen = secureGetItem(SEEN_KEY, { persistent: true }) === "true";
      const shouldIntercept = enabled && !isAppInstalled() && !dismissedRecently && !seen;
      if (!shouldIntercept) {
        return;
      }
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    const raw = secureGetItem(DISMISS_KEY, { persistent: true });
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissedAt(parsed);
    }
  }, []);

  useEffect(() => {
    const raw = secureGetItem(SEEN_KEY, { persistent: true });
    if (raw === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasSeen(true);
      hasRecordedSeen.current = true;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsReady(false);
      return;
    }
    if (delayMs === 0) {
      // eslint-disable-next-line react-hooks-set-state-in-effect
      setIsReady(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setIsReady(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, delayMs]);

  const isDismissed = useMemo(() => {
    if (!dismissedAt) return false;
    if (!mountedAt) return false;
    return mountedAt - dismissedAt < DISMISS_DURATION_MS;
  }, [dismissedAt, mountedAt]);

  const shouldOfferInstall = enabled && isReady && !installed && !isDismissed && !hasSeen;
  const shouldRenderPrompt = shouldOfferInstall && (isIos ? !deferredPrompt : Boolean(deferredPrompt));

  useEffect(() => {
    if (!shouldRenderPrompt || hasRecordedSeen.current) return;
    secureSetItem(SEEN_KEY, "true", { persistent: true });
    hasRecordedSeen.current = true;
  }, [shouldRenderPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "dismissed") {
      const now = Date.now();
      secureSetItem(DISMISS_KEY, String(now), { persistent: true });
      setDismissedAt(now);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    const now = Date.now();
    secureSetItem(DISMISS_KEY, String(now), { persistent: true });
    setDismissedAt(now);
    setDeferredPrompt(null);
  };

  if (!enabled || installed || isDismissed || hasSeen) return null;

  if (shouldRenderPrompt && isIos && !deferredPrompt) {
    const panelClasses =
      "fixed bottom-24 right-6 w-[320px] max-w-[90vw] rounded-xl border border-orange-100 bg-white p-3 shadow-xl";
    return (
      <div
        className={panelClasses}
        style={{ zIndex: 999998 }} // Above chatbot but below toasts
        role="dialog"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-full bg-orange-100 p-2 text-orange-600">
            <Download className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Install YSP Tagum</p>
            <p className="text-xs text-gray-600">
              On iPhone, install from Safari:
            </p>
            <div className="mt-2 space-y-1 text-xs text-gray-700">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-semibold text-orange-700">
                  1
                </span>
                <span>Tap Share</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-semibold text-orange-700">
                  2
                </span>
                <span>Tap Add to Home Screen</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!shouldRenderPrompt) return null;

  const panelClasses =
    "fixed bottom-24 right-6 w-[320px] max-w-[90vw] rounded-xl border border-orange-100 bg-white p-3 shadow-xl";

  return (
    <div
      className={panelClasses}
      style={{ zIndex: 999998 }} // Above chatbot but below toasts
      role="dialog"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-full bg-orange-100 p-2 text-orange-600">
          <Download className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Install YSP Tagum</p>
          <p className="text-xs text-gray-600">
            Add the app to your home screen for faster access and offline support.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Not now
            </Button>
            <Button variant="primary" size="sm" onClick={handleInstall} icon={<Download className="h-4 w-4" />}>
              Install
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
