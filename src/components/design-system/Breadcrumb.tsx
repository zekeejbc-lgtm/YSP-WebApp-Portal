/**
 * =============================================================================
 * BREADCRUMB NAVIGATION COMPONENT
 * =============================================================================
 * 
 * Displays hierarchical page navigation with:
 * - Horizontal layout with dividers
 * - Clickable segments (except last)
 * - Active page highlighting
 * - Responsive mobile behavior (collapses middle items)
 * - Consistent with YSP design system
 * 
 * =============================================================================
 */

import { ChevronRight } from "lucide-react";
import { DESIGN_TOKENS } from "./tokens";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  isDark: boolean;
}

export default function Breadcrumb({ items, isDark }: BreadcrumbProps) {
  // For mobile: if more than 3 items, show first, ellipsis, and last two
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const shouldCollapse = isMobile && items.length > 3;
  
  let displayItems = items;
  if (shouldCollapse) {
    // Show: Home / ... / Parent / Current
    displayItems = [
      items[0],
      { label: "..." },
      ...items.slice(-2)
    ];
  }

  return (
    <nav
      className="flex items-center flex-wrap gap-2"
      aria-label="Breadcrumb"
      style={{
        marginBottom: `${DESIGN_TOKENS.spacing.scale.md}px`,
      }}
    >
      {displayItems.map((item, index) => {
        const isLast = index === displayItems.length - 1;
        const isEllipsis = item.label === "...";
        const hasAction = item.onClick && !isLast && !isEllipsis;

        return (
          <div key={index} className="flex items-center gap-2">
            {/* Breadcrumb Item */}
            {hasAction ? (
              <button
                onClick={item.onClick}
                className="transition-colors duration-200 hover:text-[#ee8724] cursor-pointer"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  color: isDark ? "#9ca3af" : "#6b7280",
                }}
              >
                {item.label}
              </button>
            ) : (
              <span
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: isLast
                    ? DESIGN_TOKENS.typography.fontWeight.semibold
                    : DESIGN_TOKENS.typography.fontWeight.medium,
                  color: isLast
                    ? DESIGN_TOKENS.colors.brand.orange
                    : isDark
                    ? "#9ca3af"
                    : "#6b7280",
                }}
              >
                {item.label}
              </span>
            )}

            {/* Divider */}
            {!isLast && (
              <ChevronRight
                className="flex-shrink-0"
                style={{
                  width: "16px",
                  height: "16px",
                  color: isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)",
                }}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
