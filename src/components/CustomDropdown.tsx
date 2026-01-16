/**
 * =============================================================================
 * CUSTOM UNIVERSAL DROPDOWN COMPONENT
 * =============================================================================
 * 
 * YSP-branded dropdown with:
 * - Glassmorphism styling
 * - Smooth animations
 * - Custom chevron icon
 * - Dark mode support
 * - Consistent with design system
 * - Accessible keyboard navigation
 * 
 * =============================================================================
 */

import { useState, useRef, useEffect } from "react";
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
  forceDirection?: "up" | "down"; // Force dropdown to always open in a specific direction
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(200);
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');

  // Function to calculate position and open dropdown
  const calculateAndOpen = () => {
    if (!dropdownRef.current) return;

    const maxDropdownHeight = maxHeight ?? 200;
    
    // If forceDirection is set, use it directly
    if (forceDirection) {
      setOpenDirection(forceDirection);
      setDropdownMaxHeight(maxDropdownHeight);
      setIsOpen(true);
      return;
    }
    
    const rect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Find the closest modal or scrollable parent
    let modalParent: Element | null = dropdownRef.current.parentElement;
    while (modalParent) {
      const style = window.getComputedStyle(modalParent);
      // Look for modal containers (fixed position with high z-index, or flex column with max-height)
      const isModal = style.position === 'fixed' || 
                      (style.maxHeight && style.maxHeight !== 'none' && style.display === 'flex');
      const isScrollable = style.overflow === 'auto' || style.overflowY === 'auto' || 
                          style.overflow === 'scroll' || style.overflowY === 'scroll';
      if (isModal || isScrollable) {
        break;
      }
      modalParent = modalParent.parentElement;
    }
    
    let spaceBelow: number;
    let spaceAbove: number;
    
    if (modalParent) {
      // Use the modal/scrollable parent as boundary
      const parentRect = modalParent.getBoundingClientRect();
      spaceBelow = parentRect.bottom - rect.bottom - 20;
      spaceAbove = rect.top - parentRect.top - 20;
    } else {
      // Use viewport as boundary
      spaceBelow = viewportHeight - rect.bottom - 20;
      spaceAbove = rect.top - 20;
    }
    
    // Decide direction: prefer down, but switch to up if significantly more space above
    const minDropdownHeight = 100;
    
    if (spaceBelow < minDropdownHeight && spaceAbove > spaceBelow) {
      // Open upward - not enough space below
      setOpenDirection('up');
      setDropdownMaxHeight(Math.min(maxDropdownHeight, Math.max(80, spaceAbove)));
    } else {
      // Open downward (default)
      setOpenDirection('down');
      setDropdownMaxHeight(Math.min(maxDropdownHeight, Math.max(80, spaceBelow)));
    }
    
    setIsOpen(true);
  };

  // Convert options to consistent format
  const normalizedOptions: CustomDropdownOption[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  // Find selected option
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  return (
    <div
      ref={dropdownRef}
      className={`relative ${className}`}
      style={{ width: "100%" }}
    >
      {/* Trigger Button */}
      <button
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

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute w-full rounded-lg overflow-hidden shadow-2xl animate-in fade-in duration-200 ${
            openDirection === 'up' 
              ? 'bottom-full mb-2 slide-in-from-bottom-2' 
              : 'top-full mt-2 slide-in-from-top-2'
          }`}
          style={{
            background: isDark
              ? "rgba(17, 24, 39, 0.98)"
              : "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
            border: `2px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
            maxHeight: `${dropdownMaxHeight}px`,
            overflowY: "auto",
            zIndex: 50,
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
                        ? "rgba(246, 66, 31, 0.15)"
                        : "rgba(246, 66, 31, 0.08)"
                      : "transparent",
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
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!option.disabled && !isSelected) {
                      e.currentTarget.style.background = "transparent";
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
        </div>
      )}
    </div>
  );
}

/**
 * =============================================================================
 * USAGE EXAMPLES
 * =============================================================================
 * 
 * // Simple string options:
 * <CustomDropdown
 *   value={selectedValue}
 *   onChange={setSelectedValue}
 *   options={["Option 1", "Option 2", "Option 3"]}
 *   isDark={isDark}
 * />
 * 
 * // Object options with disabled items:
 * <CustomDropdown
 *   value={selectedRole}
 *   onChange={setSelectedRole}
 *   options={[
 *     { value: "admin", label: "Admin" },
 *     { value: "member", label: "Member" },
 *     { value: "guest", label: "Guest", disabled: true }
 *   ]}
 *   placeholder="Select a role"
 *   isDark={isDark}
 *   size="lg"
 *   variant="filled"
 * />
 * 
 * =============================================================================
 */
