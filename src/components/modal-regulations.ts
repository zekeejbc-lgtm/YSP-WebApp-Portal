/**
 * =============================================================================
 * MODAL REGULATIONS - YSP Design System
 * =============================================================================
 * 
 * Central source of truth for all modal/dialog styling and behavior.
 * Import and use these constants across the application to ensure consistency.
 * 
 * DO NOT modify individual modals - update this file instead.
 * 
 * =============================================================================
 * ⚠️ CRITICAL RESPONSIVE DESIGN REGULATION ⚠️
 * =============================================================================
 * 
 * ALL NEW UI ELEMENTS MUST BE RESPONSIVE AND MOBILE-FRIENDLY:
 * 
 * ✅ REQUIRED PRACTICES:
 * 
 * 1. **Mobile-First Approach**
 *    - Design for mobile (320px+) first, then enhance for desktop
 *    - Test all layouts at 320px, 375px, 768px, 1024px, and 1440px widths
 * 
 * 2. **Flexible Layouts**
 *    - Use `flex-wrap`, `grid`, and responsive utilities (sm:, md:, lg:)
 *    - Avoid fixed widths - use `max-w-*` with `w-full` instead
 *    - Stack elements vertically on mobile, horizontally on desktop
 * 
 * 3. **Adaptive Typography**
 *    - Use `text-xs sm:text-sm md:text-base` patterns
 *    - Hide non-essential text on mobile with `hidden sm:inline`
 *    - Use `clamp()` for fluid typography
 * 
 * 4. **Touch-Friendly Targets**
 *    - Minimum 44px × 44px touch targets on mobile
 *    - Add adequate spacing between interactive elements (min 8px)
 *    - Use `active:scale-95` for tactile feedback
 * 
 * 5. **Responsive Spacing**
 *    - Use `p-4 md:p-6 lg:p-8` patterns
 *    - Reduce padding/margins on mobile to maximize content space
 *    - Use `gap-2 md:gap-4` for flexible spacing
 * 
 * 6. **Content Priority**
 *    - Show critical content first on mobile
 *    - Use `order-*` utilities to reorder on different screens
 *    - Hide decorative elements on small screens
 * 
 * 7. **Modal/Dialog Responsiveness**
 *    - Full-width on mobile with minimal margin (mx-4)
 *    - Centered with max-width on desktop
 *    - Use `max-h-[90vh]` with `overflow-y-auto` for tall content
 * 
 * ❌ AVOID:
 * - Fixed pixel widths without max-width
 * - Horizontal scrolling on mobile
 * - Text smaller than 14px on mobile
 * - Overlapping elements at any screen size
 * - Truncated or cut-off content
 * 
 * 📱 TESTING CHECKLIST:
 * - [ ] Works on iPhone SE (375px)
 * - [ ] Works on standard mobile (390px-430px)
 * - [ ] Works on tablet (768px-1024px)
 * - [ ] Works on desktop (1280px+)
 * - [ ] No horizontal scroll at any size
 * - [ ] All interactive elements are accessible
 * - [ ] Text is readable without zooming
 * 
 * =============================================================================
 */

export const MODAL_REGULATIONS = {
  /**
   * OVERLAY (Backdrop)
   * The dark background behind modals
   */
  overlay: {
    background: {
      light: "rgba(0, 0, 0, 0.4)",
      dark: "rgba(0, 0, 0, 0.6)",
    },
    backdropBlur: "12px",
    zIndex: 50,
  },

  /**
   * PANEL (Modal Container)
   * The floating card that contains modal content
   */
  panel: {
    maxWidth: {
      small: "500px",      // For simple dialogs
      medium: "700px",     // For forms
      large: "900px",      // For detailed views
      xlarge: "1200px",    // For complex interfaces
    },
    
    // Glassmorphism background
    background: {
      light: "rgba(255, 255, 255, 0.95)",
      dark: "rgba(15, 23, 42, 0.95)",
    },
    
    // Enhanced backdrop blur for floating effect
    backdropFilter: "blur(24px) saturate(180%)",
    
    // Border styling
    border: {
      width: "1px",
      color: {
        light: "rgba(0, 0, 0, 0.08)",
        dark: "rgba(255, 255, 255, 0.08)",
      },
      radius: "16px", // Rounded corners
    },
    
    // Floating shadow - creates elevation
    shadow: {
      light: "0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.1)",
      dark: "0 20px 60px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3)",
    },
    
    // Spacing
    padding: {
      none: "0px",
      small: "16px",
      medium: "24px",
      large: "32px",
    },
    
    // Maximum height
    maxHeight: "85vh",
    
    // Scale animation
    animation: {
      enter: {
        initial: { opacity: 0, scale: 0.95, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      },
      exit: {
        opacity: 0,
        scale: 0.95,
        y: 10,
        transition: "all 0.15s ease-in",
      },
    },
  },

  /**
   * HEADER
   * Top section of modal with title and close button
   */
  header: {
    height: 80,  // Standard header height
    padding: "24px",
    
    // Header background gradient
    gradient: {
      light: {
        red: "linear-gradient(135deg, rgba(246, 66, 31, 0.05) 0%, rgba(238, 135, 36, 0.05) 100%)",
        blue: "linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(147, 51, 234, 0.05) 100%)",
        green: "linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)",
      },
      dark: {
        red: "linear-gradient(135deg, rgba(246, 66, 31, 0.1) 0%, rgba(238, 135, 36, 0.1) 100%)",
        blue: "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)",
        green: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)",
      },
    },
    
    border: {
      color: {
        light: "rgba(0, 0, 0, 0.08)",
        dark: "rgba(255, 255, 255, 0.08)",
      },
    },
  },

  /**
   * TABS
   * Tab navigation section
   */
  tabs: {
    height: 60,  // Standard tab height
    padding: "16px",
  },

  /**
   * BODY
   * Main content area of modal
   */
  body: {
    padding: "24px",
    maxHeight: "60vh",
    overflowY: "auto" as const,
    spacing: "24px", // Gap between sections
  },

  /**
   * FOOTER
   * Bottom section with action buttons
   */
  footer: {
    height: 80,  // Standard footer height
    padding: "24px",
    gap: "12px",
    border: {
      color: {
        light: "rgba(0, 0, 0, 0.08)",
        dark: "rgba(255, 255, 255, 0.08)",
      },
    },
  },

  /**
   * PADDING
   * Standard padding values
   */
  padding: {
    content: "32px",  // Content area padding
    section: "24px",  // Section padding
    card: "16px",     // Card padding
  },

  /**
   * CLOSE BUTTON
   * X button in top-right corner
   */
  closeButton: {
    size: "40px",
    iconSize: "20px",
    position: {
      top: "16px",
      right: "16px",
    },
    background: {
      hover: {
        light: "rgba(0, 0, 0, 0.05)",
        dark: "rgba(255, 255, 255, 0.05)",
      },
    },
    borderRadius: "8px",
    transition: "all 0.2s ease",
  },

  /**
   * BADGES & STATUS
   * For status indicators and pills
   */
  badge: {
    borderRadius: "999px", // Full rounded
    padding: {
      x: "12px",
      y: "4px",
    },
    fontSize: "12px",
    fontWeight: 600,
    
    colors: {
      open: {
        bg: "rgba(16, 185, 129, 0.15)",
        text: "#10b981",
      },
      closed: {
        bg: "rgba(239, 68, 68, 0.15)",
        text: "#ef4444",
      },
      warning: {
        bg: "rgba(251, 191, 36, 0.15)",
        text: "#fbbf24",
      },
      info: {
        bg: "rgba(59, 130, 246, 0.15)",
        text: "#3b82f6",
      },
    },
  },

  /**
   * CARD SECTIONS
   * For nested cards within modal body
   */
  card: {
    background: {
      light: "rgba(249, 250, 251, 0.8)",
      dark: "rgba(30, 41, 59, 0.5)",
    },
    border: {
      color: {
        light: "rgba(0, 0, 0, 0.06)",
        dark: "rgba(255, 255, 255, 0.06)",
      },
      radius: "12px",
    },
    padding: "16px",
  },

  /**
   * TRANSITIONS
   * Standard animation timings
   */
  transitions: {
    fast: "0.15s ease",
    normal: "0.2s ease",
    slow: "0.3s ease",
    spring: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

/**
 * HELPER FUNCTIONS
 * Utility functions for common modal operations
 */

export const getModalStyles = (isDark: boolean, size: 'small' | 'medium' | 'large' | 'xlarge' = 'large') => ({
  overlay: {
    background: isDark ? MODAL_REGULATIONS.overlay.background.dark : MODAL_REGULATIONS.overlay.background.light,
    backdropFilter: MODAL_REGULATIONS.overlay.backdropBlur,
  },
  panel: {
    maxWidth: MODAL_REGULATIONS.panel.maxWidth[size],
    background: isDark ? MODAL_REGULATIONS.panel.background.dark : MODAL_REGULATIONS.panel.background.light,
    backdropFilter: MODAL_REGULATIONS.panel.backdropFilter,
    borderColor: isDark ? MODAL_REGULATIONS.panel.border.color.dark : MODAL_REGULATIONS.panel.border.color.light,
    borderWidth: MODAL_REGULATIONS.panel.border.width,
    borderRadius: MODAL_REGULATIONS.panel.border.radius,
    boxShadow: isDark ? MODAL_REGULATIONS.panel.shadow.dark : MODAL_REGULATIONS.panel.shadow.light,
  },
  header: {
    borderColor: isDark ? MODAL_REGULATIONS.header.border.color.dark : MODAL_REGULATIONS.header.border.color.light,
  },
  footer: {
    borderColor: isDark ? MODAL_REGULATIONS.footer.border.color.dark : MODAL_REGULATIONS.footer.border.color.light,
  },
  card: {
    background: isDark ? MODAL_REGULATIONS.card.background.dark : MODAL_REGULATIONS.card.background.light,
    borderColor: isDark ? MODAL_REGULATIONS.card.border.color.dark : MODAL_REGULATIONS.card.border.color.light,
  },
});

export const getHeaderGradient = (isDark: boolean, color: 'red' | 'blue' | 'green' = 'red') => {
  return isDark 
    ? MODAL_REGULATIONS.header.gradient.dark[color]
    : MODAL_REGULATIONS.header.gradient.light[color];
};