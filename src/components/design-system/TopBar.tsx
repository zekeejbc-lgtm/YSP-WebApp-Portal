/**
 * =============================================================================
 * TOP BAR MASTER COMPONENT - DUAL MODE DESIGN
 * =============================================================================
 * 
 * Two distinct modes:
 * - LOGGED OUT: Floating glassmorphism bar with navigation tabs
 * - LOGGED IN: Completely hidden (returns null)
 * 
 * =============================================================================
 */

import { Moon, Sun, Menu, Home as HomeIcon, Telescope, FolderOpen, Mail, MessageCircle, LogIn, LogOut } from "lucide-react";
import { DESIGN_TOKENS, getGlassStyle } from "./tokens";
import { ExpandableTabs } from "./ExpandableTabs";

interface TopBarProps {
  isDark: boolean;
  onToggleDark: () => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  logoUrl: string;
  fallbackLogoUrl: string;
  onHomeClick: () => void;
  onAboutClick: () => void;
  onProjectsClick: () => void;
  onContactClick: () => void;
  onOrgChartClick?: () => void;
  onFeedbackClick?: () => void;
  onLoginClick?: () => void;
  onLogoutClick?: () => void;
  isLoggedIn: boolean;
  activePage?: string;
}

export default function TopBar({
  isDark,
  onToggleDark,
  isMenuOpen,
  onToggleMenu,
  logoUrl,
  fallbackLogoUrl,
  onHomeClick,
  onAboutClick,
  onProjectsClick,
  onContactClick,
  onOrgChartClick,
  onFeedbackClick,
  onLoginClick,
  onLogoutClick,
  isLoggedIn,
  activePage = "home",
}: TopBarProps) {
  const glassStyle = getGlassStyle(isDark);

  // Navigation tabs for homepage sections (LOGGED OUT)
  const navigationTabs = [
    { title: "Home", icon: HomeIcon, onClick: onHomeClick },
    { title: "About", icon: Telescope, onClick: onAboutClick },
    { title: "Projects", icon: FolderOpen, onClick: onProjectsClick },
    { title: "Contact", icon: Mail, onClick: onContactClick },
    { title: "Feedback", icon: MessageCircle, onClick: onFeedbackClick || (() => {}) },
  ];

  // ========================================================================
  // LOGGED IN MODE - Completely hidden (returns null)
  // ========================================================================
  if (isLoggedIn) {
    return null; // COMPLETELY HIDDEN when logged in
  }

  // ========================================================================
  // LOGGED OUT MODE - Floating glassmorphism bar with navigation
  // ========================================================================
  return (
    <header
      className="fixed top-4 right-4 rounded-2xl border transition-all duration-300"
      style={{
        left: "1rem",
        height: `${DESIGN_TOKENS.layout.topBar.height}px`,
        borderRadius: `${DESIGN_TOKENS.layout.topBar.borderRadius}px`,
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.2)",
        zIndex: 40, // --z-topbar
        ...glassStyle,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onToggleMenu}
          className="md:hidden p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all flex items-center justify-center flex-shrink-0"
          style={{
            transitionDuration: `${DESIGN_TOKENS.motion.duration.normal}ms`,
          }}
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo */}
        <a
          href="#home"
          onClick={onHomeClick}
          className="flex items-center gap-2 md:gap-3 flex-shrink-0"
        >
          <img
            src={logoUrl}
            alt="YSP Logo"
            className="w-10 h-10 object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackLogoUrl;
            }}
          />
          <div className="flex flex-col leading-tight">
            <span
              className="text-[10px] xs:text-xs sm:text-sm md:text-base whitespace-nowrap"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                lineHeight: "1.2",
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              Youth Service Philippines
            </span>
            <span
              className="text-[9px] xs:text-[10px] sm:text-xs whitespace-nowrap"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                color: isDark ? "#9ca3af" : "#6b7280",
                fontStyle: "italic",
                lineHeight: "1.2",
              }}
            >
              Tagum Chapter
            </span>
          </div>
        </a>

        {/* Desktop Navigation - ExpandableTabs */}
        <nav className="hidden md:flex items-center gap-4 ml-auto">
          <ExpandableTabs
            tabs={navigationTabs}
            activeColor="text-[#f6421f]"
            className="bg-white/50 dark:bg-black/50"
            activeTab={activePage}
          />
        </nav>

        {/* Right side actions */}
        <div className="flex items-center gap-2 ml-auto md:ml-4">
          {/* Login Button */}
          {onLoginClick && (
            <button
              onClick={onLoginClick}
              className="hidden md:flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                fontWeight: "600",
                fontSize: "14px",
                boxShadow: "0 2px 8px rgba(246, 66, 31, 0.3)",
                fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              }}
            >
              <LogIn className="w-4 h-4" />
              <span>Log In</span>
            </button>
          )}
          
          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDark}
            className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all flex items-center justify-center"
            style={{
              transitionDuration: `${DESIGN_TOKENS.motion.duration.normal}ms`,
              width: `${DESIGN_TOKENS.interactive.minTapTarget}px`,
              height: `${DESIGN_TOKENS.interactive.minTapTarget}px`,
            }}
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}