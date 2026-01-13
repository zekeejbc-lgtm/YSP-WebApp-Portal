/**
 * =============================================================================
 * YSP DESIGN SYSTEM TOKENS
 * =============================================================================
 * 
 * Single source of truth for all design values based on SMART Design Spec.
 * These tokens ensure consistency across all pages and components.
 * 
 * Based on: Home page as reference template
 * 
 * =============================================================================
 */

export const DESIGN_TOKENS = {
  // ============================================================================
  // BRAND COLORS
  // ============================================================================
  colors: {
    brand: {
      red: '#f6421f',      // Primary YSP Red
      orange: '#ee8724',   // Secondary YSP Orange
      yellow: '#fbcb29',   // Accent YSP Yellow
    },
    primary: {
      main: '#f6421f',
      light: '#ee8724',
    },
    status: {
      present: '#10b981',  // Green
      late: '#f59e0b',     // Amber
      excused: '#3b82f6',  // Blue
      absent: '#ef4444',   // Red
      success: '#10b981',
      error: '#ef4444',
    },
  },

  // ============================================================================
  // LAYOUT & SPACING
  // ============================================================================
  layout: {
    topBar: {
      height: 64,                    // Fixed 64px height
      borderRadius: 16,              // 16px rounded corners
    },
    sideBar: {
      widthDesktop: 280,             // Fixed 280px width on desktop
      widthMobile: '100%',           // Full viewport width on mobile
    },
    contentMaxWidth: 1200,           // 1200px max content width
  },

  spacing: {
    base: 4,                         // 4px base unit
    scale: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 24,
      '2xl': 32,
    },
    cardPadding: {
      desktop: 24,
      mobile: 16,
    },
  },

  // ============================================================================
  // BORDER RADIUS
  // ============================================================================
  radius: {
    card: 16,                        // 16px for cards
    modal: 20,                       // 20px for modals
    button: 12,                      // 12px for buttons
    input: 8,                        // 8px for inputs
    pill: 28,                        // 28px for pills/chips
  },

  // ============================================================================
  // SHADOWS & ELEVATION
  // ============================================================================
  shadows: {
    sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
    md: '0 6px 12px rgba(0, 0, 0, 0.12)',
    lg: '0 12px 24px rgba(0, 0, 0, 0.15)',
    glass: {
      light: '0 8px 32px 0 rgba(31, 38, 135, 0.15), inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
      dark: '0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
    },
  },

  // ============================================================================
  // GLASSMORPHISM
  // ============================================================================
  glass: {
    blur: 12,                        // 12px backdrop blur
    backdropOpacity: {
      light: 0.4,                    // 0.4 in light mode
      dark: 0.6,                     // 0.6 in dark mode
    },
  },

  // ============================================================================
  // TYPOGRAPHY
  // ============================================================================
  typography: {
    fontFamily: {
      headings: 'var(--font-headings)', // Lexend
      body: 'var(--font-sans)',         // Roboto
    },
    fontSize: {
      h1: 28,                        // 28px
      h2: 22,                        // 22px
      h3: 18,                        // 18px
      h4: 16,                        // 16px
      h5: 14,                        // 14px
      body: 16,                      // 16px
      caption: 14,                   // 14px
      small: 12,                     // 12px
      button: 16,                    // 16px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: 1.4,
  },

  // ============================================================================
  // INTERACTIVE ELEMENTS
  // ============================================================================
  interactive: {
    button: {
      paddingX: 16,                  // 16px horizontal
      paddingY: 10,                  // 10px vertical
      minWidth: 120,                 // 120px minimum width
      height: 44,                    // 44px height
    },
    input: {
      height: 44,                    // 44px height
      paddingX: 12,
      paddingY: 10,
    },
    dropdown: {
      itemHeight: 40,                // 40px per item
      maxItems: 8,                   // Show max 8 items
    },
    focusRing: {
      width: 2,                      // 2px focus ring
    },
    minTapTarget: 40,                // 40px minimum tap target
  },

  // ============================================================================
  // TABLES
  // ============================================================================
  table: {
    rowHeight: 48,                   // 48px row height
    headerStickyOffset: 64,          // 64px from top bar
    columnGutter: 16,                // 16px between columns
    statusChip: {
      radius: 8,
      height: 28,
    },
  },

  // ============================================================================
  // CHARTS
  // ============================================================================
  charts: {
    donutInnerRadius: '55%',         // 55% inner radius
    minSliceLabelFont: 12,           // 12px min font
    tooltipFont: 14,                 // 14px tooltip
    legendWrap: 12,                  // Wrap at 12 chars
  },

  // ============================================================================
  // ANIMATION & MOTION
  // ============================================================================
  motion: {
    duration: {
      fast: 200,                     // 200ms
      normal: 300,                   // 300ms
      slow: 400,                     // 400ms
    },
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // ============================================================================
  // TOAST NOTIFICATIONS
  // ============================================================================
  toast: {
    height: 56,                      // 56px height
    autoDismiss: 3000,               // 3 seconds
    showDelay: 120,                  // 120ms show delay
  },

  // ============================================================================
  // MODALS & OVERLAYS
  // ============================================================================
  modal: {
    maxWidthDesktop: 720,            // 720px max width
    paddingDesktop: 24,
    paddingMobile: 16,
  },

  // ============================================================================
  // IMAGES & MEDIA
  // ============================================================================
  media: {
    profileImage: {
      size: 120,                     // 120px profile images
    },
    qrCode: {
      sizeDesktop: 280,              // 280px on desktop
      sizeMobile: 200,               // 200px on mobile
      outlineThickness: 4,           // 4px outline
    },
    cameraPreview: {
      aspectRatio: '16/9',           // 16:9 aspect ratio
    },
    imagePreview: {
      size: 120,                     // 120px thumbnail
    },
  },

  // ============================================================================
  // SEARCH & AUTOCOMPLETE
  // ============================================================================
  search: {
    height: 44,                      // 44px input height
    suggestionMaxItems: 8,           // Show max 8 suggestions
    loadingBarHeight: 4,             // 4px loading indicator
  },

  // ============================================================================
  // GRID SYSTEM
  // ============================================================================
  grid: {
    columns: 12,                     // 12 column grid
    gap: 24,                         // 24px gap
    cardMinWidth: 320,               // 320px min card width
  },

  // ============================================================================
  // ROLE COLORS (for visual distinction)
  // ============================================================================
  roles: {
    auditor: '#8b5cf6',              // Purple
    admin: '#f6421f',                // YSP Red
    head: '#ee8724',                 // YSP Orange
    member: '#3b82f6',               // Blue
    guest: '#6b7280',                // Gray
  },
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get glassmorphism styles for cards and containers
 */
export const getGlassStyle = (isDark: boolean) => ({
  backdropFilter: `blur(${DESIGN_TOKENS.glass.blur}px)`,
  WebkitBackdropFilter: `blur(${DESIGN_TOKENS.glass.blur}px)`,
  background: isDark 
    ? `rgba(30, 30, 30, ${DESIGN_TOKENS.glass.backdropOpacity.dark})` 
    : `rgba(255, 255, 255, ${DESIGN_TOKENS.glass.backdropOpacity.light})`,
  boxShadow: isDark 
    ? DESIGN_TOKENS.shadows.glass.dark 
    : DESIGN_TOKENS.shadows.glass.light,
});

/**
 * Get responsive padding for cards
 */
export const getCardPadding = (isMobile: boolean) => 
  isMobile ? DESIGN_TOKENS.spacing.cardPadding.mobile : DESIGN_TOKENS.spacing.cardPadding.desktop;

/**
 * Get role color
 */
export const getRoleColor = (role: string): string => {
  const normalizedRole = role.toLowerCase();
  return DESIGN_TOKENS.roles[normalizedRole as keyof typeof DESIGN_TOKENS.roles] || DESIGN_TOKENS.roles.guest;
};

/**
 * Get status color
 */
export const getStatusColor = (status: string): string => {
  const normalizedStatus = status.toLowerCase();
  return DESIGN_TOKENS.colors.status[normalizedStatus as keyof typeof DESIGN_TOKENS.colors.status] || DESIGN_TOKENS.colors.status.absent;
};
