/**
 * =============================================================================
 * BUTTON COMPONENT
 * =============================================================================
 * 
 * YSP Design System Button Component
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Height: 44px (from DESIGN_TOKENS)
 * ✅ Proper padding and sizing
 * ✅ Variant support (primary, secondary, ghost)
 * ✅ Icon support
 * ✅ Full width option
 * 
 * =============================================================================
 */

import { DESIGN_TOKENS } from "./tokens";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  className?: string;
  style?: React.CSSProperties;
}

export default function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  icon,
  type = "button",
  className = "",
  style = {},
}: ButtonProps) {
  const baseStyles = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: `${DESIGN_TOKENS.spacing.scale.sm}px`,
    borderRadius: `${DESIGN_TOKENS.radius.button}px`,
    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
    transition: `all ${DESIGN_TOKENS.motion.duration.fast}ms ${DESIGN_TOKENS.motion.easing.default}`,
    cursor: disabled ? "not-allowed" : "pointer",
    width: fullWidth ? "100%" : "auto",
  };

  const sizeStyles = {
    sm: {
      height: "36px",
      paddingLeft: `${DESIGN_TOKENS.spacing.scale.md}px`,
      paddingRight: `${DESIGN_TOKENS.spacing.scale.md}px`,
      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
    },
    md: {
      height: `${DESIGN_TOKENS.interactive.button.height}px`,
      paddingLeft: `${DESIGN_TOKENS.interactive.button.paddingX}px`,
      paddingRight: `${DESIGN_TOKENS.interactive.button.paddingX}px`,
      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
    },
    lg: {
      height: "52px",
      paddingLeft: `${DESIGN_TOKENS.spacing.scale.xl}px`,
      paddingRight: `${DESIGN_TOKENS.spacing.scale.xl}px`,
      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
    },
  };

  const variantStyles = {
    primary: {
      background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
      color: "#ffffff",
      boxShadow: "0 4px 12px rgba(246, 66, 31, 0.3)",
      border: "2px solid transparent",
    },
    secondary: {
      background: "rgba(128, 128, 128, 0.1)",
      color: DESIGN_TOKENS.colors.brand.orange,
      border: "2px solid rgba(238, 135, 36, 0.3)",
    },
    ghost: {
      background: "transparent",
      color: DESIGN_TOKENS.colors.brand.orange,
      border: "2px solid transparent",
    },
  };

  const disabledStyle = disabled
    ? {
        opacity: 0.5,
        pointerEvents: "none" as const,
      }
    : {};

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`hover:scale-105 active:scale-95 ${className}`}
      style={{
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...disabledStyle,
        ...style,
      }}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}