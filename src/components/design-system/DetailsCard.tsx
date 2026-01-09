/**
 * =============================================================================
 * DETAILS CARD MASTER COMPONENT
 * =============================================================================
 * 
 * Standardized card for displaying detailed information:
 * - Glassmorphism design
 * - 16px border radius
 * - 24px padding desktop, 16px mobile
 * - Two-column layout on desktop
 * - Single column on mobile
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Border radius: 16px
 * ✅ Padding: 24px desktop, 16px mobile
 * ✅ Two-column layout with 16px gutter
 * ✅ Glassmorphism with 12px blur
 * 
 * =============================================================================
 */

import { X } from "lucide-react";
import { DESIGN_TOKENS, getGlassStyle, getCardPadding } from "./tokens";

interface DetailField {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

interface DetailsCardProps {
  title: string;
  fields: DetailField[];
  profileImage?: string;
  initials?: string;
  onClose: () => void;
  isDark: boolean;
  isMobile?: boolean;
  actions?: React.ReactNode;
}

export default function DetailsCard({
  title,
  fields,
  profileImage,
  initials,
  onClose,
  isDark,
  isMobile = false,
  actions,
}: DetailsCardProps) {
  const glassStyle = getGlassStyle(isDark);
  const padding = getCardPadding(isMobile);

  return (
    <div
      className="border rounded-lg shadow-lg"
      style={{
        borderRadius: `${DESIGN_TOKENS.radius.card}px`,
        padding: `${padding}px`,
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        ...glassStyle,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between pb-4 border-b"
        style={{
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          marginBottom: `${DESIGN_TOKENS.spacing.scale.lg}px`,
        }}
      >
        <h3
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            color: DESIGN_TOKENS.colors.brand.orange,
          }}
        >
          {title}
        </h3>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/10 transition-all"
          style={{
            transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
          }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Image - Show initials as fallback when no image */}
      <div className="flex justify-center mb-6">
        <div
          className="rounded-full overflow-hidden border-4 flex items-center justify-center"
          style={{
            width: `${DESIGN_TOKENS.media.profileImage.size}px`,
            height: `${DESIGN_TOKENS.media.profileImage.size}px`,
            borderColor: DESIGN_TOKENS.colors.brand.orange,
            backgroundColor: !profileImage ? DESIGN_TOKENS.colors.brand.orange : undefined,
          }}
        >
          {profileImage ? (
            <img
              src={profileImage}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide the broken image and show initials container
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && initials) {
                  parent.innerHTML = `<span style="font-family: 'Lexend', sans-serif; font-size: 32px; font-weight: 700; color: white;">${initials}</span>`;
                  parent.style.backgroundColor = '#FF8800';
                }
              }}
            />
          ) : (
            <span
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: '32px',
                fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                color: 'white',
                textTransform: 'uppercase',
              }}
            >
              {initials || '?'}
            </span>
          )}
        </div>
      </div>

      {/* Fields */}
      <div
        className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}
        style={{
          gap: `${DESIGN_TOKENS.spacing.scale.lg}px`,
        }}
      >
        {fields.map((field, index) => (
          <div
            key={index}
            className={field.fullWidth ? "col-span-full" : ""}
          >
            <div className="flex items-start gap-2">
              {field.icon && (
                <div className="text-[#f6421f] mt-1 flex-shrink-0">
                  {field.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div
                  className="text-muted-foreground"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    marginBottom: "4px",
                  }}
                >
                  {field.label}
                </div>
                <div
                  className="break-words"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
                  }}
                >
                  {field.value}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions (if provided) */}
      {actions && (
        <div
          className="pt-4 border-t mt-6 flex gap-3 justify-end"
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}