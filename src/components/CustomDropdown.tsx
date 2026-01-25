/**
 * =============================================================================
 * CUSTOM UNIVERSAL DROPDOWN COMPONENT
 * =============================================================================
 * 
 * YSP-branded dropdown with:
 * - Uses React Portal to escape parent overflow:hidden containers
 * - Fixed positioning for reliable z-index and visibility
 * - Dark mode support
 * - Accessible keyboard navigation
 * 
 * =============================================================================
 */

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { DESIGN_TOKENS } from "./design-system";

interface CustomDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[] | string[];
  placeholder?: string;
  className?: string;
  isDark?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "filled" | "outlined";
  forceDirection?: "up" | "down";
  maxHeight?: number;
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  className = "",
  isDark = false,
  disabled = false,
  size = "md",
  variant = "default",
  forceDirection,
  maxHeight,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(200);
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Function to calculate position and open dropdown
  const calculateAndOpen = () => {
    if (!triggerRef.current) return;

    const maxDropdownHeight = maxHeight ?? 200;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Calculate position for fixed positioning (relative to viewport)
    const spaceBelow = viewportHeight - rect.bottom - 20;
    const spaceAbove = rect.top - 20;
    
    // Mobile detection
    const isMobile = window.innerWidth < 768;
    const bottomThreshold = isMobile ? 180 : 120;
    
    let direction: 'up' | 'down' = 'down';
    let calculatedMaxHeight = maxDropdownHeight;
    
    if (forceDirection) {
      direction = forceDirection;
    } else if (spaceBelow < bottomThreshold && spaceAbove > spaceBelow) {
      direction = 'up';
      calculatedMaxHeight = Math.min(maxDropdownHeight, Math.max(120, spaceAbove));
    } else {
      direction = 'down';
      calculatedMaxHeight = Math.min(maxDropdownHeight, Math.max(120, spaceBelow));
    }
    
    setOpenDirection(direction);
    setDropdownMaxHeight(calculatedMaxHeight);
    setDropdownPosition({
      top: direction === 'down' ? rect.bottom + 8 : rect.top - 8,
      left: rect.left,
      width: rect.width,
    });
    setIsOpen(true);
  };

  // Update position on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    
    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: openDirection === 'down' ? rect.bottom + 8 : rect.top - 8,
        left: rect.left,
        width: rect.width,
      });
    };
    
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, openDirection]);

  // Convert options to consistent format
  const normalizedOptions: CustomDropdownOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  // Find selected option
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && 
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      if (event.key === "Escape") {
        setIsOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const currentIndex = normalizedOptions.findIndex((opt) => opt.value === value);
        const nextIndex = Math.min(currentIndex + 1, normalizedOptions.length - 1);
        onChange(normalizedOptions[nextIndex].value);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = normalizedOptions.findIndex((opt) => opt.value === value);
        const prevIndex = Math.max(currentIndex - 1, 0);
        onChange(normalizedOptions[prevIndex].value);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, value, normalizedOptions, onChange]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  // Size styles
  const sizeStyles = {
    sm: {
      height: "36px",
      padding: "0 12px",
      fontSize: "13px",
    },
    md: {
      height: "44px",
      padding: "0 16px",
      fontSize: "14px",
    },
    lg: {
      height: "56px",
      padding: "0 20px",
      fontSize: "18px",
    },
  };

  // Variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case "filled":
        return {
          background: isDark
            ? "rgba(30, 41, 59, 0.9)"
            : "rgba(249, 250, 251, 1)",
          border: "2px solid transparent",
        };
      case "outlined":
        return {
          background: "transparent",
          border: `2px solid ${isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)"}`,
        };
      default:
        return {
          background: isDark
            ? "rgba(30, 41, 59, 0.7)"
            : "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          border: `2px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
        };
    }
  };

  // Dropdown menu rendered via Portal
  const dropdownMenu = isOpen && createPortal(
    <div
      ref={dropdownRef}
      className="animate-in fade-in duration-150"
      style={{
        position: 'fixed',
        top: openDirection === 'down' ? dropdownPosition.top : 'auto',
        bottom: openDirection === 'up' ? `calc(100vh - ${dropdownPosition.top}px)` : 'auto',
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        maxHeight: `${dropdownMaxHeight}px`,
        overflowY: "auto",
        zIndex: 999999,
        background: isDark ? "#111827" : "#ffffff",
        border: `2px solid ${isDark ? "#374151" : "#d1d5db"}`,
        borderRadius: "8px",
        boxShadow: isDark 
          ? '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
          : '0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Options List */}
      <div className="py-2">
        {normalizedOptions.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => !option.disabled && handleSelect(option.value)}
              disabled={option.disabled}
              className="w-full flex items-center justify-between px-4 transition-all"
              style={{
                height: sizeStyles[size].height,
                background: isSelected
                  ? isDark
                    ? "#1e293b"
                    : "#fef2f2"
                  : isDark
                    ? "#111827"
                    : "#ffffff",
                color: option.disabled
                  ? isDark
                    ? "rgba(255, 255, 255, 0.3)"
                    : "rgba(0, 0, 0, 0.3)"
                  : isSelected
                  ? DESIGN_TOKENS.colors.brand.red
                  : isDark
                  ? "#ffffff"
                  : "#1f2937",
                cursor: option.disabled ? "not-allowed" : "pointer",
                fontWeight: isSelected
                  ? DESIGN_TOKENS.typography.fontWeight.semibold
                  : DESIGN_TOKENS.typography.fontWeight.normal,
                fontSize: sizeStyles[size].fontSize,
              }}
              onMouseEnter={(e) => {
                if (!option.disabled && !isSelected) {
                  e.currentTarget.style.background = isDark
                    ? "#1e293b"
                    : "#f3f4f6";
                }
              }}
              onMouseLeave={(e) => {
                if (!option.disabled && !isSelected) {
                  e.currentTarget.style.background = isDark
                    ? "#111827"
                    : "#ffffff";
                }
              }}
            >
              <span>{option.label}</span>
              {isSelected && (
                <Check
                  style={{
                    width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
                    height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Empty State */}
      {normalizedOptions.length === 0 && (
        <div
          className="px-4 text-center"
          style={{
            height: sizeStyles[size].height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isDark ? "rgba(255, 255, 255, 0.5)" : "rgba(0, 0, 0, 0.5)",
            fontSize: sizeStyles[size].fontSize,
          }}
        >
          No options available
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div className={`relative ${className}`} style={{ width: "100%" }}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          if (isOpen) {
            setIsOpen(false);
          } else {
            calculateAndOpen();
          }
        }}
        disabled={disabled}
        className="w-full flex items-center justify-between rounded-lg transition-all outline-none focus:ring-2 focus:ring-[#f6421f]/20"
        style={{
          ...getVariantStyles(),
          ...sizeStyles[size],
          color: isDark ? "#ffffff" : "#1f2937",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
          fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
          borderColor: isOpen ? DESIGN_TOKENS.colors.brand.red : undefined,
        }}
      >
        <span className={selectedOption ? "" : "opacity-50"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`transition-transform duration-200 ${
            isOpen ? (openDirection === 'up' ? '' : 'rotate-180') : ''
          }`}
          style={{
            width: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            height: size === "sm" ? "16px" : size === "lg" ? "20px" : "18px",
            color: DESIGN_TOKENS.colors.brand.red,
          }}
        />
      </button>

      {/* Dropdown Menu via Portal */}
      {dropdownMenu}
    </div>
  );
}
