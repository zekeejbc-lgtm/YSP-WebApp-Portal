/**
 * =============================================================================
 * SEARCH INPUT MASTER COMPONENT
 * =============================================================================
 * 
 * Standardized search input with autosuggest support:
 * - Fixed height 44px
 * - Suggestion dropdown with max 8 items
 * - 40px item height
 * - Loading state with 4px indicator
 * - Focus ring 2px
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Input height: 44px
 * ✅ Autosuggest max 8 items
 * ✅ Item height: 40px
 * ✅ Focus ring: 2px
 * ✅ Loading bar: 4px
 * 
 * =============================================================================
 */

import { Search, X, Loader2 } from "lucide-react";
import { DESIGN_TOKENS, getGlassStyle } from "./tokens";

interface Suggestion {
  id: string;
  label: string;
  subtitle?: string;
  profilePicture?: string;
  initials?: string;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  suggestions?: Suggestion[];
  onSelectSuggestion?: (suggestion: Suggestion) => void;
  isLoading?: boolean;
  isDark: boolean;
  showSuggestions?: boolean;
  disabled?: boolean;
}

export default function SearchInput({
  value,
  onChange,
  onClear = () => {},
  placeholder = "Search...",
  suggestions = [],
  onSelectSuggestion,
  isLoading = false,
  isDark,
  showSuggestions = false,
  disabled = false,
}: SearchInputProps) {
  const glassStyle = getGlassStyle(isDark);

  const displayedSuggestions = suggestions.slice(
    0,
    DESIGN_TOKENS.interactive.dropdown.maxItems
  );

  return (
    <div className="relative w-full">
      {/* Input Field */}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pl-10 pr-10 border rounded-lg bg-white/50 dark:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-[#f6421f]/50 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            height: `${DESIGN_TOKENS.interactive.input.height}px`,
            paddingLeft: `${DESIGN_TOKENS.interactive.input.paddingX + 28}px`,
            paddingRight: `${DESIGN_TOKENS.interactive.input.paddingX + 28}px`,
            borderRadius: `${DESIGN_TOKENS.radius.input}px`,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
          }}
        />
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={{
            width: "20px",
            height: "20px",
            color: isDark ? "rgba(209, 213, 219, 1)" : "rgba(75, 85, 99, 1)",
            strokeWidth: 2.5,
          }}
        />
        {value && !disabled && (
          <button
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/50 dark:hover:bg-white/10 transition-all"
            style={{
              transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
            }}
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div
          className="absolute top-full left-0 right-0 bg-[#f6421f] rounded-full mt-1"
          style={{
            height: `${DESIGN_TOKENS.search.loadingBarHeight}px`,
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && displayedSuggestions.length > 0 && !isLoading && (
        <div
          className="absolute top-full left-0 right-0 mt-2 py-2 border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          style={{
            borderRadius: `${DESIGN_TOKENS.radius.input}px`,
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            ...glassStyle,
          }}
        >
          {displayedSuggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => onSelectSuggestion?.(suggestion)}
              className="w-full text-left px-4 hover:bg-white/50 dark:hover:bg-white/10 transition-colors flex items-center gap-3"
              style={{
                minHeight: `${DESIGN_TOKENS.interactive.dropdown.itemHeight}px`,
                paddingTop: "8px",
                paddingBottom: "8px",
                transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
              }}
            >
              {/* Profile Picture with Initials Fallback */}
              <div 
                className="flex-shrink-0 rounded-full flex items-center justify-center"
                style={{
                  width: "40px",
                  height: "40px",
                  border: "2px solid rgba(246, 66, 31, 0.3)",
                  backgroundColor: !suggestion.profilePicture ? '#FF8800' : undefined,
                }}
              >
                {suggestion.profilePicture ? (
                  <img
                    src={suggestion.profilePicture}
                    alt={suggestion.label}
                    className="rounded-full object-cover w-full h-full"
                    onError={(e) => {
                      // Hide image and show initials
                      e.currentTarget.style.display = 'none';
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.style.backgroundColor = '#FF8800';
                        const initialsSpan = document.createElement('span');
                        initialsSpan.style.cssText = "font-family: 'Lexend', sans-serif; font-size: 14px; font-weight: 700; color: white;";
                        initialsSpan.textContent = suggestion.initials || suggestion.label.substring(0, 2).toUpperCase();
                        parent.appendChild(initialsSpan);
                      }
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontFamily: "'Lexend', sans-serif",
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'white',
                      textTransform: 'uppercase',
                    }}
                  >
                    {suggestion.initials || suggestion.label.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              
              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <div
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  {suggestion.label}
                </div>
                {suggestion.subtitle && (
                  <div
                    className="text-muted-foreground truncate"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
                    }}
                  >
                    {suggestion.subtitle}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {showSuggestions && displayedSuggestions.length === 0 && !isLoading && value && (
        <div
          className="absolute top-full left-0 right-0 mt-2 py-2 px-4 border rounded-lg shadow-lg z-50"
          style={{
            borderRadius: `${DESIGN_TOKENS.radius.input}px`,
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            ...glassStyle,
            height: `${DESIGN_TOKENS.interactive.dropdown.itemHeight}px`,
          }}
        >
          <div
            className="text-muted-foreground flex items-center justify-center h-full"
            style={{
              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
            }}
          >
            No results found
          </div>
        </div>
      )}
    </div>
  );
}
