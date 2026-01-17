/**
 * =============================================================================
 * PAGE LAYOUT MASTER COMPONENT
 * =============================================================================
 * 
 * Wrapper for all internal pages ensuring consistent:
 * - TopBar integration (64px offset)
 * - SideBar integration (280px offset on desktop)
 * - Content max width (1200px)
 * - Proper spacing and padding
 * - Glassmorphism background
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ TopBar offset: 64px
 * ✅ SideBar offset: 280px desktop
 * ✅ Content max width: 1200px
 * ✅ Proper spacing scale
 * ✅ Glassmorphism background
 * 
 * =============================================================================
 */

import { useEffect, useState } from "react";
import { X, ArrowLeft } from "lucide-react";
import { DESIGN_TOKENS, getGlassStyle } from "./tokens";
import Breadcrumb, { BreadcrumbItem } from "./Breadcrumb";
import {
  getCacheVersionFromBackend,
  getLocalCacheVersion,
  setLocalCacheVersion,
} from "../../services/gasSystemToolsService";

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  isDark: boolean;
  onClose: () => void;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export default function PageLayout({
  children,
  title,
  subtitle,
  isDark,
  onClose,
  actions,
  breadcrumbs,
}: PageLayoutProps) {
  const glassStyle = getGlassStyle(isDark);
  const [cacheVersion, setCacheVersion] = useState<number>(() => {
    try {
      return getLocalCacheVersion();
    } catch {
      return 0;
    }
  });
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  useEffect(() => {
    let isMounted = true;

    const syncCacheVersion = async () => {
      try {
        const backendVersion = await getCacheVersionFromBackend();
        if (!isMounted) return;
        setLocalCacheVersion(backendVersion);
        setCacheVersion(backendVersion);
      } catch {
        if (!isMounted) return;
        setCacheVersion(getLocalCacheVersion());
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "ysp_cache_version") {
        setCacheVersion(getLocalCacheVersion());
      }
    };

    const handleCacheVersionChange = () => {
      setCacheVersion(getLocalCacheVersion());
    };

    syncCacheVersion();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("cache-version-changed", handleCacheVersionChange);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("cache-version-changed", handleCacheVersionChange);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300 relative">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/40 dark:bg-orange-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-yellow-200/40 dark:bg-yellow-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-red-200/40 dark:bg-red-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      {/* Floating Header - Fixed at Top (same level as homepage TopBar) */}
      <div 
        className="fixed left-0 right-0 transition-all duration-300"
        style={{
          top: '1rem', // Same level as homepage TopBar (16px from top)
          zIndex: 200, // Higher than filters (z-100) to stay on top when scrolling
        }}
      >
        <div
          className="max-w-7xl mx-auto px-4 md:px-6"
          style={{
            maxWidth: `${DESIGN_TOKENS.layout.contentMaxWidth}px`,
          }}
        >
          {/* Page Header Card */}
          <div
            className="border rounded-lg shadow-lg backdrop-blur-xl"
            style={{
              borderRadius: `${DESIGN_TOKENS.radius.card}px`,
              padding: `${DESIGN_TOKENS.spacing.scale.lg}px ${DESIGN_TOKENS.spacing.scale.md}px`,
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              ...glassStyle,
            }}
          >
            {/* Mobile Layout - Single Row */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(238, 135, 36, 0.15), rgba(246, 66, 31, 0.15))',
                  border: '2px solid rgba(238, 135, 36, 0.3)',
                  color: '#ee8724',
                  fontWeight: '600',
                  fontSize: '0.75rem'
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <div className="flex-1 min-w-0">
                <h1
                  className="break-words"
                  style={{
                    fontFamily: 'var(--font-headings)',
                    fontWeight: 'var(--font-weight-bold)',
                    letterSpacing: '-0.02em',
                    color: isDark ? '#fb923c' : '#ea580c',
                    lineHeight: '1.15',
                    fontSize: 'clamp(0.9rem, 3.4vw, 1.2rem)'
                  }}
                >
                  {title}
                </h1>
              </div>

              {actions && <div className="flex-shrink-0">{actions}</div>}
            </div>

            {/* Desktop Layout - Horizontal */}
            <div className="hidden md:flex items-center justify-between gap-4">
              {/* Back Button - Left */}
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(238, 135, 36, 0.15), rgba(246, 66, 31, 0.15))',
                  border: '2px solid rgba(238, 135, 36, 0.3)',
                  color: '#ee8724',
                  fontWeight: '600',
                  fontSize: '0.875rem'
                }}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {/* Title Section - Centered */}
              <div className="flex-1 text-center min-w-0">
                <h1
                  style={{
                    fontFamily: 'var(--font-headings)',
                    fontWeight: 'var(--font-weight-bold)',
                    letterSpacing: '-0.02em',
                    color: isDark ? '#fb923c' : '#ea580c',
                    lineHeight: '1.2',
                    fontSize: 'clamp(1rem, 2.5vw, 1.5rem)'
                  }}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p
                    className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                    style={{
                      fontWeight: '500',
                      lineHeight: '1.2'
                    }}
                  >
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Right Side - Actions */}
              <div className="flex-shrink-0 flex items-center justify-end" style={{ minWidth: actions ? 'auto' : '80px' }}>
                {actions || null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area - With proper padding to account for fixed header */}
      <div
        className="relative"
        style={{
          paddingTop: `${DESIGN_TOKENS.layout.topBar.height + 60}px`, // Padding for fixed header
          minHeight: "100vh",
        }}
      >
        <div
          className="max-w-7xl mx-auto px-4 md:px-6"
          style={{
            maxWidth: `${DESIGN_TOKENS.layout.contentMaxWidth}px`,
          }}
        >
          {/* Breadcrumb Navigation - Scrolls with content */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="mb-6">
              <Breadcrumb items={breadcrumbs} isDark={isDark} />
            </div>
          )}

          {/* Page Content */}
          <div>{children}</div>

          <footer className="border-t border-border py-8 relative mt-8">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                &copy; 2025 Youth Service Philippines - Tagum Chapter. All rights reserved.
              </p>
              <p className="mt-2">Shaping the Future to a Greater Society</p>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                App version: {appVersion} | Cache version: {cacheVersion}
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
