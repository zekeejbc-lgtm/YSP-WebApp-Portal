import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import Button from "./design-system/Button";

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

  useEffect(() => {
    setInstalled(isAppInstalled());
    setIsIos(isIosDevice());

    const onBeforeInstall = (event: Event) => {
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
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return;
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      setDismissedAt(parsed);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(SEEN_KEY);
    if (raw === "true") {
      setHasSeen(true);
      hasRecordedSeen.current = true;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsReady(false);
      return;
    }
    if (delayMs === 0) {
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
    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  }, [dismissedAt]);

  const shouldOfferInstall = enabled && isReady && !installed && !isDismissed && !hasSeen;
  const shouldRenderPrompt = shouldOfferInstall && (isIos ? !deferredPrompt : Boolean(deferredPrompt));

  useEffect(() => {
    if (!shouldRenderPrompt || hasRecordedSeen.current) return;
    localStorage.setItem(SEEN_KEY, "true");
    hasRecordedSeen.current = true;
  }, [shouldRenderPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "dismissed") {
      const now = Date.now();
      localStorage.setItem(DISMISS_KEY, String(now));
      setDismissedAt(now);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    const now = Date.now();
    localStorage.setItem(DISMISS_KEY, String(now));
    setDismissedAt(now);
    setDeferredPrompt(null);
  };

  if (!enabled || installed || isDismissed || hasSeen) return null;

  if (shouldRenderPrompt && isIos && !deferredPrompt) {
    return (
      <div
        className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-orange-200 bg-white/95 p-4 shadow-xl backdrop-blur"
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

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-orange-200 bg-white/95 p-4 shadow-xl backdrop-blur"
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
