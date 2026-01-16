/**
 * =============================================================================
 * SIDE BAR MASTER COMPONENT - HOVER-TO-EXPAND VERSION
 * =============================================================================
 * 
 * Dynamic sidebar with:
 * - Desktop: Hover to expand from 60px to 240px
 * - Mobile: Hamburger menu with full-screen overlay
 * - Smooth animations with framer-motion
 * - YSP branding with glassmorphism
 * - Orange gradient for active pages
 * - Grouped navigation with dropdowns
 * 
 * =============================================================================
 */

import { ChevronDown, X, Moon, Sun, User, LogOut, Home as HomeIcon, Menu } from "lucide-react";
import { useState, createContext, useContext, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { DESIGN_TOKENS } from "./tokens";

export interface NavPage {
  id: string;
  label: string;
  action: () => void;
  roles?: string[];
  icon?: ReactNode;
}

export interface NavGroup {
  id: string;
  label: string;
  pages: NavPage[];
  roles?: string[];
  icon?: ReactNode;
}

interface SideBarContextProps {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const SideBarContext = createContext<SideBarContextProps | undefined>(undefined);

export const useSideBar = () => {
  const context = useContext(SideBarContext);
  if (!context) {
    throw new Error("useSideBar must be used within SideBarProvider");
  }
  return context;
};

interface SideBarProps {
  isDark: boolean;
  isOpen: boolean;
  onClose: () => void;
  navigationGroups: NavGroup[];
  activePage: string;
  openMobileGroup: string | null;
  onMobileGroupToggle: (id: string | null) => void;
  isLoggedIn: boolean;
  userRole: string;
  onToggleDark: () => void;
  onProfileClick: () => void;
  onLogout: () => void;
  onHomeClick: () => void;
  onLoginClick: () => void;
  logoUrl?: string;
  userName?: string;
  userProfilePicture?: string;
}

export default function SideBar(props: SideBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Use the already-filtered navigation groups from parent
  // App.tsx handles all filtering logic via getVisibleGroups()
  const visibleGroups = props.navigationGroups;

  return (
    <SideBarContext.Provider value={{ isExpanded, setIsExpanded }}>
      {/* Desktop Sidebar - Only when logged in */}
      {props.isLoggedIn && (
        <DesktopSideBar
          {...props}
          visibleGroups={visibleGroups}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
      )}

      {/* Mobile Sidebar */}
      <MobileSideBar
        {...props}
        visibleGroups={visibleGroups}
      />
    </SideBarContext.Provider>
  );
}

// Desktop Sidebar Component - Hover to Expand
function DesktopSideBar({
  isDark,
  visibleGroups,
  activePage,
  isExpanded,
  setIsExpanded,
  openDropdown,
  setOpenDropdown,
  onToggleDark,
  onProfileClick,
  onHomeClick,
  onLogout,
  onLoginClick,
  isLoggedIn,
  logoUrl,
  userName = "Juan Dela Cruz",
  userProfilePicture,
}: SideBarProps & {
  visibleGroups: NavGroup[];
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
}) {
  return (
    <motion.aside
      className="hidden md:block fixed left-0 top-0 h-full border-r overflow-hidden"
      style={{
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        background: isDark
          ? "rgba(17, 24, 39, 0.98)"
          : "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 50, // Higher than main content (z-10)
      }}
      animate={{
        width: isExpanded ? "300px" : "60px",
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => {
        setIsExpanded(false);
        setOpenDropdown(null);
      }}
    >
      <div className="h-full flex flex-col py-4">
        {/* Logo Header + Theme Toggle */}
        <div
          className="px-2 pb-3 border-b mb-2"
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Logo + YSP Text - Logo stays visible, text animates */}
            <div className={`flex items-center gap-3 min-w-0 flex-1 ${!isExpanded ? 'justify-center' : 'px-2'}`}>
              {/* Logo - Always visible, never animated */}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="YSP Logo"
                  className="w-8 h-8 object-contain flex-shrink-0"
                />
              )}
              
              {/* Text container - Animates independently */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col overflow-hidden"
                  >
                    <div
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.caption - 1}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: DESIGN_TOKENS.colors.brand.orange,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Youth Service Philippines
                    </div>
                    <div
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.caption - 2}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        color: isDark ? "#9ca3af" : "#6b7280",
                        fontStyle: "italic",
                        lineHeight: 1.2,
                      }}
                    >
                      Tagum Chapter
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme Toggle - Top Right (only when expanded) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={onToggleDark}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex-shrink-0"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  aria-label="Toggle dark mode"
                >
                  {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Home Button */}
        <div className="px-2 mb-2">
          <button
            onClick={onHomeClick}
            className={`w-full flex items-center gap-3 rounded-lg transition-all ${
              activePage === "home" ? "text-white" : "hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#ee8724]"
            }`}
            style={{
              background:
                activePage === "home"
                  ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                  : "transparent",
              justifyContent: isExpanded ? "flex-start" : "center",
              padding: isExpanded ? "10px 12px" : "10px",
            }}
          >
            <HomeIcon className="w-5 h-5 flex-shrink-0" />
            <motion.span
              animate={{
                opacity: isExpanded ? 1 : 0,
                width: isExpanded ? "auto" : 0,
              }}
              transition={{ duration: 0.2 }}
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Home
            </motion.span>
          </button>
        </div>

        {/* Navigation Groups - Scrollable */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {visibleGroups.map((group) => (
            <div key={group.id}>
              {/* Group Header */}
              <button
                onClick={() =>
                  setOpenDropdown(openDropdown === group.id ? null : group.id)
                }
                className="w-full flex items-center gap-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all group"
                style={{
                  justifyContent: isExpanded ? "space-between" : "center",
                  padding: isExpanded ? "8px 12px" : "8px",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {group.icon && <span className="flex-shrink-0 group-hover:text-[#ee8724] transition-colors">{group.icon}</span>}
                  <motion.span
                    className="group-hover:text-[#ee8724] transition-colors"
                    animate={{
                      opacity: isExpanded ? 1 : 0,
                      width: isExpanded ? "auto" : 0,
                    }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#9ca3af" : "#6b7280",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                    }}
                  >
                    {group.label}
                  </motion.span>
                </div>
                {isExpanded && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform flex-shrink-0 ${
                      openDropdown === group.id ? "rotate-180" : ""
                    }`}
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  />
                )}
              </button>

              {/* Group Pages */}
              <AnimatePresence>
                {isExpanded && openDropdown === group.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden pl-3 space-y-1 mt-1"
                  >
                    {group.pages.map((page) => {
                      const isActive = activePage === page.id;
                      return (
                        <button
                          key={page.id}
                          onClick={page.action}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                            isActive
                              ? "text-white"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#ee8724]"
                          }`}
                          style={{
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                            fontWeight: isActive
                              ? DESIGN_TOKENS.typography.fontWeight.semibold
                              : DESIGN_TOKENS.typography.fontWeight.medium,
                            background: isActive
                              ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                              : "transparent",
                          }}
                        >
                          {page.label}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div
          className="border-t pt-3 px-2 space-y-2"
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          }}
        >
          {isLoggedIn ? (
            <>
              {/* Profile Section - Picture + Name when expanded, just icon when collapsed */}
              <button
                onClick={onProfileClick}
                className={`w-full flex items-center gap-3 rounded-lg transition-all ${
                  activePage === "my-profile"
                    ? "text-white"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-[#ee8724]"
                }`}
                style={{
                  background:
                    activePage === "my-profile"
                      ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                      : "transparent",
                  justifyContent: isExpanded ? "flex-start" : "center",
                  padding: isExpanded ? "10px 12px" : "10px",
                }}
              >
                {userProfilePicture ? (
                  <img
                    src={userProfilePicture}
                    alt={userName}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Hide broken image, fallback to default icon
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    }}
                  >
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <motion.span
                  animate={{
                    opacity: isExpanded ? 1 : 0,
                    width: isExpanded ? "auto" : 0,
                  }}
                  transition={{ duration: 0.2 }}
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  {userName}
                </motion.span>
              </button>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 rounded-lg transition-all text-white"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                  justifyContent: isExpanded ? "center" : "center",
                  padding: isExpanded ? "10px 12px" : "10px",
                }}
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <motion.span
                  animate={{
                    opacity: isExpanded ? 1 : 0,
                    width: isExpanded ? "auto" : 0,
                  }}
                  transition={{ duration: 0.2 }}
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                  }}
                >
                  Log Out
                </motion.span>
              </button>
            </>
          ) : (
            /* Login Button for non-logged-in users */
            <button
              onClick={onLoginClick}
              className="w-full flex items-center gap-3 rounded-lg transition-all text-white"
              style={{
                background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                justifyContent: isExpanded ? "center" : "center",
                padding: isExpanded ? "10px 12px" : "10px",
              }}
            >
              <User className="w-5 h-5 flex-shrink-0" />
              <motion.span
                animate={{
                  opacity: isExpanded ? 1 : 0,
                  width: isExpanded ? "auto" : 0,
                }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                Log In
              </motion.span>
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  );
}

// Mobile Sidebar Component - Full Screen Overlay
function MobileSideBar({
  isDark,
  isOpen,
  onClose,
  visibleGroups,
  activePage,
  openMobileGroup,
  onMobileGroupToggle,
  isLoggedIn,
  onToggleDark,
  onProfileClick,
  onLogout,
  onHomeClick,
  onLoginClick,
  logoUrl,
  userName = "Juan Dela Cruz",
  userProfilePicture,
}: SideBarProps & { visibleGroups: NavGroup[] }) {
  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="md:hidden fixed inset-0 bg-black/30"
            style={{ zIndex: 40 }} // Mobile overlay - below modals (9999)
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            className="md:hidden fixed top-0 left-0 h-full w-full max-w-xs border-r shadow-2xl"
            style={{
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              background: isDark
                ? "rgba(17, 24, 39, 0.98)"
                : "rgba(255, 255, 255, 0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              zIndex: 45, // Mobile panel - below modals (9999)
            }}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            <div className="h-full flex flex-col">
              {/* Header - Logo + Theme Toggle + Close */}
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                }}
              >
                {/* Logo + YSP Text */}
                <div className="flex items-center gap-3 min-w-0">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="YSP Logo"
                      className="w-8 h-8 object-contain flex-shrink-0"
                    />
                  )}
                  <div className="flex flex-col min-w-0">
                    <div
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.caption - 1}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: DESIGN_TOKENS.colors.brand.orange,
                        lineHeight: 1.2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Youth Service Philippines
                    </div>
                    <div
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.caption - 2}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        color: isDark ? "#9ca3af" : "#6b7280",
                        fontStyle: "italic",
                        lineHeight: 1.2,
                      }}
                    >
                      Tagum Chapter
                    </div>
                  </div>
                </div>

                {/* Theme Toggle + Close */}
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={onToggleDark}
                    className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all flex-shrink-0"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                    aria-label="Toggle dark mode"
                  >
                    {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </motion.button>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all flex-shrink-0"
                    aria-label="Close sidebar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Home Button */}
              <div className="px-3 pt-4 pb-2">
                <button
                  onClick={() => {
                    onHomeClick();
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    activePage === "home"
                      ? "text-white"
                      : "hover:bg-white/50 dark:hover:bg-white/10 hover:text-[#ee8724]"
                  }`}
                  style={{
                    background:
                      activePage === "home"
                        ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                        : "transparent",
                  }}
                >
                  <HomeIcon className="w-5 h-5 flex-shrink-0" />
                  <span
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    }}
                  >
                    Home
                  </span>
                </button>
              </div>

              {/* Navigation Groups */}
              <nav className="flex-1 overflow-y-auto px-3 pb-4">
                {isLoggedIn ? (
                  // Logged in: Show grouped navigation
                  visibleGroups.map((group, groupIndex) => (
                    <div
                      key={group.id}
                      style={{
                        marginBottom:
                          groupIndex < visibleGroups.length - 1
                            ? `${DESIGN_TOKENS.spacing.scale.lg}px`
                            : "0",
                      }}
                    >
                      {/* Group Header */}
                      <button
                        onClick={() =>
                          onMobileGroupToggle(openMobileGroup === group.id ? null : group.id)
                        }
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all mb-1 group"
                      >
                        <div className="flex items-center gap-2">
                          {group.icon && <span className="flex-shrink-0 group-hover:text-[#ee8724] transition-colors">{group.icon}</span>}
                          <span
                            className="group-hover:text-[#ee8724] transition-colors"
                            style={{
                              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                              color: isDark ? "#9ca3af" : "#6b7280",
                            }}
                          >
                            {group.label}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            openMobileGroup === group.id ? "rotate-180" : ""
                          }`}
                          style={{
                            color: isDark ? "#9ca3af" : "#6b7280",
                          }}
                        />
                      </button>

                      {/* Group Pages */}
                      <AnimatePresence>
                        {openMobileGroup === group.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-1">
                              {group.pages.map((page) => {
                                const isActive = activePage === page.id;
                                return (
                                  <button
                                    key={page.id}
                                    onClick={() => {
                                      page.action();
                                      onClose();
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                                      isActive
                                        ? "text-white"
                                        : "hover:bg-white/50 dark:hover:bg-white/10 hover:text-[#ee8724]"
                                    }`}
                                    style={{
                                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                                      fontWeight: isActive
                                        ? DESIGN_TOKENS.typography.fontWeight.semibold
                                        : DESIGN_TOKENS.typography.fontWeight.medium,
                                      background: isActive
                                        ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                                        : "transparent",
                                    }}
                                  >
                                    {page.label}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  // Logged out: Show flat navigation
                  <div className="space-y-1">
                    {visibleGroups.flatMap((group) =>
                      group.pages.map((page) => {
                        const isActive = activePage === page.id;
                        return (
                          <button
                            key={page.id}
                            onClick={() => {
                              page.action();
                              onClose();
                            }}
                            className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                              isActive
                                ? "text-white"
                                : "hover:bg-white/50 dark:hover:bg-white/10 hover:text-[#ee8724]"
                            }`}
                            style={{
                              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                              fontWeight: isActive
                                ? DESIGN_TOKENS.typography.fontWeight.semibold
                                : DESIGN_TOKENS.typography.fontWeight.medium,
                              background: isActive
                                ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                                : "transparent",
                            }}
                          >
                            {page.icon && <span className="flex-shrink-0">{page.icon}</span>}
                            <span>{page.label}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </nav>

              {/* Bottom Actions - Profile + Logout OR Login */}
              <div
                className="border-t flex flex-col gap-2 px-3 py-3"
                style={{
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                }}
              >
                {isLoggedIn ? (
                  <>
                    {/* Profile Section - Picture + Name */}
                    <button
                      onClick={() => {
                        onProfileClick();
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        activePage === "my-profile"
                          ? "text-white"
                          : "hover:bg-white/50 dark:hover:bg-white/10"
                      }`}
                      style={{
                        background:
                          activePage === "my-profile"
                            ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                            : "transparent",
                      }}
                    >
                      {userProfilePicture ? (
                        <img
                          src={userProfilePicture}
                          alt={userName}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // Hide broken image, fallback to default icon
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                          }}
                        >
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <span
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        }}
                      >
                        {userName}
                      </span>
                    </button>

                    {/* Log Out Button */}
                    <button
                      onClick={() => {
                        onLogout();
                        onClose();
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all text-white"
                      style={{
                        background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                        boxShadow: "0 2px 8px rgba(246, 66, 31, 0.3)",
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      <LogOut className="w-5 h-5" />
                      Log Out
                    </button>
                  </>
                ) : (
                  /* Log In Button */
                  <button
                    onClick={() => {
                      onLoginClick();
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg transition-all text-white"
                    style={{
                      background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                      boxShadow: "0 2px 8px rgba(246, 66, 31, 0.3)",
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    <User className="w-5 h-5" />
                    Log In
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export { SideBar };
