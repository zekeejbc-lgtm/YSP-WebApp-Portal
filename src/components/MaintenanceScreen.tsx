import { Wrench, Clock, AlertCircle, ArrowLeft, Facebook, Instagram, Settings, Hammer, Mail, User } from "lucide-react";
import { DESIGN_TOKENS } from "./design-system";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useState, useEffect } from "react";
import { CustomToast } from "./CustomToast";
import { MaintenanceLoginModal } from "./MaintenanceLoginModal";

interface MaintenanceScreenProps {
  message?: string;
  estimatedTime?: string;
  isFullPWA?: boolean;
  onBack?: () => void;
  pageName?: string;
  onContactDeveloper?: () => void;
  isDark?: boolean;
  reason?: string;
  onMaintenanceLogin?: (email: string, password: string) => void;
}

export default function MaintenanceScreen({
  message,
  estimatedTime,
  isFullPWA = false,
  onBack,
  pageName,
  onContactDeveloper,
  isDark = false,
  reason,
  onMaintenanceLogin,
}: MaintenanceScreenProps) {
  // Scroll-based animation state
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHoveringPhone, setIsHoveringPhone] = useState(false);
  
  // Hidden login feature
  const [clickCount, setClickCount] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);

  // Detect screen size for device mockup
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  useEffect(() => {
    if (!isFullPWA) return;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const scrollTop = target.scrollTop;
      const scrollHeight = target.scrollHeight;
      const clientHeight = target.clientHeight;
      // Calculate progress from 0 to 1 based on scroll position
      const progress = Math.min(scrollTop / clientHeight, 1);
      setScrollProgress(progress);
    };

    const scrollContainer = document.getElementById('maintenance-scroll-container');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [isFullPWA]);

  // Calculate transform values based on scroll progress
  // STAGE 1 (0-33%): Left panel fades out, right panel zooms in
  // STAGE 2 (33-66%): Phone static, fully visible
  // STAGE 3 (66-100%): Phone content scrolls
  
  // Panel 1 (Left): Fades out during first 33% of scroll
  const leftPanelProgress = Math.min(scrollProgress / 0.33, 1);
  const leftPanelScale = 1 + (leftPanelProgress * 0.5); // Scale UP to 150%
  const leftPanelOpacity = 1 - leftPanelProgress; // Fade to 0%
  
  // Panel 2 (Right): Zooms in during first 33% of scroll
  const rightPanelProgress = Math.min(scrollProgress / 0.33, 1);
  const rightPanelScale = 1.5 - (rightPanelProgress * 0.5); // Scale from 150% to 100%
  const rightPanelOpacity = rightPanelProgress; // Fade IN from 0 to 1
  
  // Phone inside panel 2 - no additional transform, just follows panel
  const phoneTranslateY = 0;
  const phoneScale = 1;

  // Calculate staggered card animations (each card appears at different scroll points)
  const getCardOpacity = (index: number) => {
    // Cards are always visible - no fade animation
    return 1;
  };

  const getCardTransform = (index: number) => {
    // Cards don't move individually - phone content scrolls instead
    return `translateY(0px)`;
  };

  // Calculate phone's internal content scroll based on parent scroll
  // STAGE 3: Only scrolls during 66-100% of parent scroll
  const phoneContentScroll = Math.max(0, (scrollProgress - 0.66) / 0.34) * 400; // Scroll up to 400px during last 34%

  // Handle login
  const handleLogin = (email: string, password: string) => {
    // Check if it's a valid admin/auditor account
    const validAccounts = [
      { email: "admin@ysp.com", password: "admin123", role: "admin" },
      { email: "auditor@ysp.com", password: "auditor123", role: "auditor" },
    ];

    const account = validAccounts.find(
      (acc) => acc.email === email && acc.password === password
    );

    if (account && (account.role === "admin" || account.role === "auditor")) {
      setShowLoginModal(false);
      setToast({
        message: `Welcome back, ${account.role}! Access granted.`,
        type: "success",
      });
      // Call the callback if provided
      if (onMaintenanceLogin) {
        onMaintenanceLogin(email, password);
      }
    } else {
      setToast({
        message: "Access denied. Only admin and auditor accounts can log in during maintenance.",
        type: "error",
      });
    }
  };

  // For Full PWA maintenance, show homepage-style maintenance screen with split layout
  if (isFullPWA) {
    return (
      <div
        className={`h-screen overflow-hidden relative ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
      >
        {/* Toast Notification */}
        {toast && (
          <CustomToast
            message={toast.message}
            type={toast.type}
            duration={4000}
            onClose={() => setToast(null)}
            isDark={isDark}
          />
        )}

        {/* Login Modal */}
        <MaintenanceLoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
          isDark={isDark}
        />

        {/* Scroll trigger area - NOW ON TOP and scrollable */}
        <div 
          id="maintenance-scroll-container"
          className="absolute inset-0 overflow-y-scroll"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: `${DESIGN_TOKENS.colors.brand.orange}30 transparent`,
            zIndex: scrollProgress > 0.33 ? 40 : 50,
            pointerEvents: "auto",
          }}
        >
          {/* Spacer to enable scrolling - THIS is what makes scrolling possible */}
          <div style={{ height: "200vh" }} />
        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
            /* Custom ultra-slim scrollbar for webkit browsers */
            #maintenance-scroll-container::-webkit-scrollbar {
              width: 2px;
            }
            #maintenance-scroll-container::-webkit-scrollbar-track {
              background: transparent;
            }
            #maintenance-scroll-container::-webkit-scrollbar-thumb {
              background: ${DESIGN_TOKENS.colors.brand.orange}30;
              border-radius: 10px;
            }
            #maintenance-scroll-container::-webkit-scrollbar-thumb:hover {
              background: ${DESIGN_TOKENS.colors.brand.orange}50;
            }
          `
        }} />

        {/* Main Content - Fixed Positioning */}
        <div className="fixed inset-0 z-10">
          <div className="relative h-screen w-full">
            {/* Left Panel - First Screen (Inner) - Fades out */}
            <div 
              className={`absolute inset-0 h-screen w-full flex flex-col justify-center px-6 sm:px-8 md:px-12 lg:px-16 xl:px-24 py-16 sm:py-20 lg:py-8 ${isDark ? "bg-gray-900" : "bg-white"}`}
              style={{
                transform: `scale(${leftPanelScale})`,
                opacity: leftPanelOpacity,
                transition: "transform 0.1s ease-out, opacity 0.1s ease-out",
                transformOrigin: "center center",
              }}
            >
              {/* Under Maintenance Badge removed as requested */}

              <div className="space-y-8 sm:space-y-6">
                {/* YSP Logo + Organization Name - Side by Side */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-4 -mt-4">
                  <ImageWithFallback
                    src="https://i.imgur.com/J4wddTW.png"
                    alt="YSP Logo"
                    className="w-20 h-20 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain flex-shrink-0"
                  />
                  <div className="text-center sm:text-left flex flex-col justify-center" style={{ paddingTop: "0.25rem" }}>
                    <h2
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                        fontSize: "clamp(1.25rem, 4vw, 1.5rem)",
                        lineHeight: "1.2",
                        color: DESIGN_TOKENS.colors.brand.red,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Youth Service Philippines
                    </h2>
                    <p
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        fontSize: "clamp(1rem, 3vw, 1.125rem)",
                        lineHeight: "1.2",
                        color: DESIGN_TOKENS.colors.brand.orange,
                      }}
                    >
                      Tagum Chapter
                    </p>
                  </div>
                </div>

                {/* Main Heading - Single Line */}
                <div className="text-center">
                  <h1
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                      fontSize: "clamp(1.75rem, 7vw, 2.75rem)",
                      lineHeight: "1.1",
                      letterSpacing: "-0.03em",
                      background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    UNDER MAINTENANCE
                  </h1>
                </div>

                {/* Description - Justified */}
                <p
                  className={`text-center ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                    fontSize: "clamp(0.9375rem, 2.5vw, 1rem)",
                    lineHeight: "1.7",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  {reason || "Web Portal is currently undergoing scheduled maintenance to improve your experience. We appreciate your patience and understanding."}
                </p>

                {/* Estimated Time */}
                {estimatedTime && (
                  <div className="flex justify-center">
                    <div 
                      className={`inline-flex items-center gap-3 px-5 py-3 rounded-xl border-2 ${isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-100 border-gray-200"}`}
                    >
                      <Clock 
                        className="w-5 h-5 flex-shrink-0" 
                        style={{ color: DESIGN_TOKENS.colors.brand.orange }}
                      />
                      <span
                        className={`${isDark ? "text-gray-200" : "text-gray-700"}`}
                        style={{
                          fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                          fontSize: "clamp(0.875rem, 2vw, 0.9375rem)",
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        }}
                      >
                        Expected completion: <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>{estimatedTime}</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Footer - Left Panel */}
                <div className="text-center mt-6 lg:mt-0">
                  <p
                    className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    }}
                  >
                    © 2026 Youth Service Philippines - Tagum Chapter. All rights reserved.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side - iPhone Mockup - Starts CLOSE, zooms OUT (Outer) */}
            <div 
              className="absolute inset-0 w-full h-screen flex items-center justify-center p-8 sm:p-12 md:p-16 lg:p-20 xl:p-24 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}08 0%, ${DESIGN_TOKENS.colors.brand.orange}12 50%, ${DESIGN_TOKENS.colors.brand.yellow}15 100%)`,
                transform: `scale(${rightPanelScale})`,
                opacity: rightPanelOpacity,
                transition: "transform 0.1s ease-out, opacity 0.1s ease-out",
                transformOrigin: "center center",
                pointerEvents: scrollProgress > 0.33 ? "auto" : "none",
                zIndex: scrollProgress > 0.33 ? 60 : 10,
              }}
            >
              {/* Decorative Background Shapes */}
              <div 
                className="absolute top-10 sm:top-20 right-10 sm:right-20 w-32 sm:w-48 lg:w-64 h-32 sm:h-48 lg:h-64 rounded-full opacity-20 blur-3xl"
                style={{
                  background: DESIGN_TOKENS.colors.brand.red,
                }}
              />
              <div 
                className="absolute bottom-10 sm:bottom-20 left-10 sm:left-20 w-40 sm:w-56 lg:w-72 h-40 sm:h-56 lg:h-72 rounded-full opacity-20 blur-3xl"
                style={{
                  background: DESIGN_TOKENS.colors.brand.yellow,
                }}
              />
              
              {/* iPhone Mockup */}
              <div 
                className="relative z-10 w-full max-w-[240px] sm:max-w-[260px] md:max-w-[280px] lg:max-w-[300px]" 
                style={{ 
                  transform: `translateY(${phoneTranslateY}px) scale(${phoneScale})`, 
                  transformOrigin: "center top",
                  transition: "transform 0.1s ease-out",
                }}
                onMouseEnter={() => setIsHoveringPhone(true)}
                onMouseLeave={() => setIsHoveringPhone(false)}
              >
                {/* iPhone Frame */}
                <div 
                  className="relative rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl p-2 sm:p-3 w-full"
                  style={{
                    aspectRatio: "280/570",
                    background: `linear-gradient(135deg, #1f2937 0%, #111827 100%)`,
                  }}
                >
                  {/* iPhone Notch */}
                  <div 
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 rounded-b-3xl z-20"
                    style={{
                      background: "#111827",
                    }}
                  />
                  
                  {/* iPhone Screen */}
                  <div 
                    className="relative w-full h-full rounded-[2.5rem] overflow-hidden"
                    style={{
                      background: isDark ? "#1f2937" : "#f9fafb",
                    }}
                  >
                    {/* Status Bar */}
                    <div className="flex items-center justify-between px-8 pt-3 pb-2">
                      <span 
                        className="text-xs"
                        style={{
                          fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          color: isDark ? "white" : "black",
                        }}
                      >
                        9:41
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-3 border border-gray-600 rounded-sm" />
                        <div className="w-1 h-2 bg-gray-600 rounded-sm" />
                      </div>
                    </div>

                    {/* Screen Content - Scrollable */}
                    <div 
                      className="px-6 pt-4 pb-2 h-full overflow-hidden" 
                      style={{ 
                        scrollbarWidth: "thin",
                        scrollbarColor: `${DESIGN_TOKENS.colors.brand.orange} transparent`,
                      }}
                    >
                      {/* Content wrapper that transforms based on parent scroll */}
                      <div
                        style={{
                          transform: `translateY(-${phoneContentScroll}px)`,
                          transition: "transform 0.1s ease-out",
                        }}
                      >
                        <style dangerouslySetInnerHTML={{
                          __html: `
                            /* Custom scrollbar for phone screen */
                            .px-6::-webkit-scrollbar {
                              width: 4px;
                            }
                            .px-6::-webkit-scrollbar-track {
                              background: transparent;
                            }
                            .px-6::-webkit-scrollbar-thumb {
                              background: ${DESIGN_TOKENS.colors.brand.orange};
                              border-radius: 10px;
                            }
                            .px-6::-webkit-scrollbar-thumb:hover {
                              background: ${DESIGN_TOKENS.colors.brand.red};
                            }
                          `
                        }} />

                        {/* Header with YSP Logo */}
                        <div className="flex items-center justify-center mb-4">
                          <ImageWithFallback
                            src="https://i.imgur.com/J4wddTW.png"
                            alt="YSP Logo"
                            className="w-16 h-16 object-contain"
                          />
                        </div>

                        {/* Under Maintenance Bubble Chat Card */}
                        <div 
                          className="rounded-2xl p-5 mb-6 shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
                          }}
                        >
                          <h3
                            className="text-center mb-2 text-white"
                            style={{
                              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                              fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                              fontSize: "1.125rem",
                            }}
                          >
                            Under Maintenance
                          </h3>
                          <p
                            className="text-center text-sm text-white/90"
                            style={{
                              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                            }}
                          >
                            We'll be back soon!
                          </p>
                        </div>

                        {/* Need Assistance Button - Inside Phone */}
                        {onContactDeveloper && (
                          <button
                            onClick={onContactDeveloper}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-white transition-all hover:scale-105 active:scale-95 shadow-lg mb-6"
                            style={{
                              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
                              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                              fontSize: "0.875rem",
                            }}
                          >
                            <AlertCircle className="w-5 h-5" />
                            Need Assistance?
                          </button>
                        )}

                        {/* Social Media Cards - Inside Phone - Scrollable */}
                        <div className="space-y-3 pb-4">
                          <p
                            className="text-sm mb-3"
                            style={{
                              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                              color: isDark ? "#d1d5db" : "#374151",
                            }}
                          >
                            Stay Connected:
                          </p>
                          
                          {/* Facebook Card */}
                          <a
                            href="https://www.facebook.com/YSPTagumChapter"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 overflow-hidden"
                            style={{
                              background: isDark ? "#374151" : "white",
                              opacity: getCardOpacity(0),
                              transform: getCardTransform(0),
                              transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
                            }}
                          >
                            <div className="flex items-center gap-4 p-4">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}, ${DESIGN_TOKENS.colors.brand.orange})`,
                                }}
                              >
                                <Facebook className="w-6 h-6 text-white" fill="white" />
                              </div>
                              <div className="flex-1">
                                <p
                                  className="text-sm mb-0.5"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                    color: isDark ? "white" : "black",
                                  }}
                                >
                                  Facebook
                                </p>
                                <p
                                  className="text-xs"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    color: isDark ? "#9ca3af" : "#6b7280",
                                  }}
                                >
                                  @YSPTagumChapter
                                </p>
                              </div>
                              <ArrowLeft 
                                className="w-5 h-5 transform rotate-180" 
                                style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                              />
                            </div>
                          </a>

                          {/* Instagram Card */}
                          <a
                            href="https://www.instagram.com/youthserviceph/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 overflow-hidden"
                            style={{
                              background: isDark ? "#374151" : "white",
                              opacity: getCardOpacity(1),
                              transform: getCardTransform(1),
                              transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
                            }}
                          >
                            <div className="flex items-center gap-4 p-4">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange}, ${DESIGN_TOKENS.colors.brand.yellow})`,
                                }}
                              >
                                <Instagram className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1">
                                <p
                                  className="text-sm mb-0.5"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                    color: isDark ? "white" : "black",
                                  }}
                                >
                                  Instagram
                                </p>
                                <p
                                  className="text-xs"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    color: isDark ? "#9ca3af" : "#6b7280",
                                  }}
                                >
                                  @ysptagumchapter
                                </p>
                              </div>
                              <ArrowLeft 
                                className="w-5 h-5 transform rotate-180" 
                                style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                              />
                            </div>
                          </a>

                          {/* Twitter/X Card */}
                          <a
                            href="https://twitter.com/ysptagum"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 overflow-hidden"
                            style={{
                              background: isDark ? "#374151" : "white",
                              opacity: getCardOpacity(2),
                              transform: getCardTransform(2),
                              transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
                            }}
                          >
                            <div className="flex items-center gap-4 p-4">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.yellow}, ${DESIGN_TOKENS.colors.brand.orange})`,
                                }}
                              >
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p
                                  className="text-sm mb-0.5"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                    color: isDark ? "white" : "black",
                                  }}
                                >
                                  Twitter / X
                                </p>
                                <p
                                  className="text-xs"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    color: isDark ? "#9ca3af" : "#6b7280",
                                  }}
                                >
                                  @ysptagum
                                </p>
                              </div>
                              <ArrowLeft 
                                className="w-5 h-5 transform rotate-180" 
                                style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                              />
                            </div>
                          </a>

                          {/* YouTube Card */}
                          <a
                            href="https://www.youtube.com/@YSPTagumChapter"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 overflow-hidden"
                            style={{
                              background: isDark ? "#374151" : "white",
                              opacity: getCardOpacity(3),
                              transform: getCardTransform(3),
                              transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
                            }}
                          >
                            <div className="flex items-center gap-4 p-4">
                              <div 
                                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}, ${DESIGN_TOKENS.colors.brand.yellow})`,
                                }}
                              >
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                </svg>
                              </div>
                              <div className="flex-1">
                                <p
                                  className="text-sm mb-0.5"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                    color: isDark ? "white" : "black",
                                  }}
                                >
                                  YouTube
                                </p>
                                <p
                                  className="text-xs"
                                  style={{
                                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                    color: isDark ? "#9ca3af" : "#6b7280",
                                  }}
                                >
                                  @YSPTagumChapter
                                </p>
                              </div>
                              <ArrowLeft 
                                className="w-5 h-5 transform rotate-180" 
                                style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                              />
                            </div>
                          </a>

                          {/* Footer - Inside Phone */}
                          <div className={`mt-6 pt-4 border-t ${isDark ? "border-gray-700" : "border-gray-300"}`}>
                            <p
                              className="text-center text-xs"
                              style={{
                                fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                                color: isDark ? "#9ca3af" : "#6b7280",
                              }}
                            >
                              © 2026 Youth Service Philippines - Tagum Chapter. All rights reserved.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* iPhone Home Indicator */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-gray-400 rounded-full" />
                  </div>

                  {/* iPhone Volume Buttons */}
                  <div 
                    className="absolute left-0 top-32 w-1 h-12 rounded-r-md"
                    style={{ background: "#374151" }}
                  />
                  <div 
                    className="absolute left-0 top-48 w-1 h-16 rounded-r-md"
                    style={{ background: "#374151" }}
                  />
                  
                  {/* iPhone Power Button */}
                  <div 
                    className="absolute right-0 top-36 w-1 h-16 rounded-l-md"
                    style={{ background: "#374151" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // For individual page maintenance, show the original card-style screen
  return (
    <div
      className={`min-h-screen relative ${isDark ? "bg-gray-900" : "bg-gray-50"}`}
    >
      {/* Toast Notification */}
      {toast && (
        <CustomToast
          message={toast.message}
          type={toast.type}
          duration={4000}
          onClose={() => setToast(null)}
          isDark={isDark}
        />
      )}

      {/* Login Modal */}
      <MaintenanceLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
        isDark={isDark}
      />

      {/* Back Button - Floating Top Left */}
      {onBack && (
        <button
          onClick={onBack}
          className="fixed top-16 left-24 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-md"
          style={{
            background: isDark 
              ? 'linear-gradient(135deg, rgba(238, 135, 36, 0.2), rgba(246, 66, 31, 0.2))'
              : 'linear-gradient(135deg, rgba(238, 135, 36, 0.15), rgba(246, 66, 31, 0.15))',
            border: '2px solid rgba(238, 135, 36, 0.4)',
            color: DESIGN_TOKENS.colors.brand.orange,
            fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            fontSize: "0.875rem",
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      )}

      {/* Under Maintenance Badge removed as requested */}

      {/* Main Content Area - Centered */}
      <div className="min-h-screen flex items-center justify-center px-6 py-24">
        {/* Main Card - All Content Centered */}
        <div
          className={`p-8 rounded-2xl shadow-xl max-w-lg w-full text-center ${isDark ? "bg-gray-800" : "bg-white"}`}
        >
          {/* YSP Logo + Organization Name - Centered */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <ImageWithFallback
              src="https://i.imgur.com/J4wddTW.png"
              alt="YSP Logo"
              className="w-20 h-20 md:w-24 md:h-24 object-contain"
            />
            <div className="text-center">
              <h2
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  fontSize: "1.5rem",
                  lineHeight: "1.2",
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                Youth Service Philippines
              </h2>
              <p
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  fontSize: "1.125rem",
                  lineHeight: "1.2",
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Tagum Chapter
              </p>
            </div>
          </div>

          {/* Main Heading - Centered */}
          <h1
            className="mb-6"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
              fontSize: "clamp(1.75rem, 5vw, 2.5rem)",
              lineHeight: "1.1",
              letterSpacing: "-0.03em",
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            UNDER MAINTENANCE
          </h1>

          {/* Description - Centered */}
          <p
            className={`mb-6 ${isDark ? "text-gray-300" : "text-gray-700"}`}
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              fontSize: "1rem",
              lineHeight: "1.6",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
            }}
          >
            {reason || "Web Portal is currently undergoing scheduled maintenance to improve your experience. We appreciate your patience and understanding."}
          </p>

          {/* Estimated Time - Centered */}
          {estimatedTime && (
            <div className="flex justify-center mb-8">
              <div 
                className={`inline-flex items-center gap-3 px-5 py-3 rounded-xl border-2 ${isDark ? "bg-gray-700/50 border-gray-600" : "bg-gray-100 border-gray-200"}`}
              >
                <Clock 
                  className="w-5 h-5" 
                  style={{ color: DESIGN_TOKENS.colors.brand.orange }}
                />
                <span
                  className={`${isDark ? "text-gray-200" : "text-gray-700"}`}
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                    fontSize: "0.9375rem",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  Expected completion: <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>{estimatedTime}</span>
                </span>
              </div>
            </div>
          )}

          {/* Social Media Links - Centered */}
          <div>
            <p
              className={`text-sm mb-4 ${isDark ? "text-gray-400" : "text-gray-600"}`}
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Stay updated on our Social Media:
            </p>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://www.facebook.com/YSPTagumChapter"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}, ${DESIGN_TOKENS.colors.brand.orange})`,
                }}
                aria-label="Visit our Facebook page"
              >
                <Facebook className="w-6 h-6 text-white" fill="white" />
              </a>
              <a
                href="https://www.instagram.com/youthserviceph/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange}, ${DESIGN_TOKENS.colors.brand.yellow})`,
                }}
                aria-label="Visit our Instagram page"
              >
                <Instagram className="w-6 h-6 text-white" />
              </a>
              <a
                href="mailto:ysptagumchapter@gmail.com"
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.yellow}, ${DESIGN_TOKENS.colors.brand.orange})`,
                }}
                aria-label="Send us an email"
              >
                <Mail className="w-6 h-6 text-white" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}