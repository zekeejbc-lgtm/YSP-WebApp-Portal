import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, X, Calendar, ChevronDown } from 'lucide-react';
import { DESIGN_TOKENS } from './design-system';
import { EventData } from '../services/gasEventsService';

interface SmartEventSearchProps {
  events: EventData[];
  selectedEventIds: string[];
  onSelectionChange: (eventIds: string[]) => void;
  isDark: boolean;
  placeholder?: string;
  disabled?: boolean;
}

// Smart date parsing - supports various formats
const parseSmartDate = (input: string): Date | null => {
  const normalizedInput = input.trim().toLowerCase();
  
  // Handle relative dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (normalizedInput === 'today') return today;
  if (normalizedInput === 'yesterday') {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return date;
  }
  if (normalizedInput === 'tomorrow') {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return date;
  }
  
  // Handle "last X days/weeks/months"
  const lastMatch = normalizedInput.match(/^last\s+(\d+)\s+(day|week|month|year)s?$/);
  if (lastMatch) {
    const num = parseInt(lastMatch[1], 10);
    const unit = lastMatch[2];
    const date = new Date(today);
    
    switch (unit) {
      case 'day': date.setDate(date.getDate() - num); break;
      case 'week': date.setDate(date.getDate() - num * 7); break;
      case 'month': date.setMonth(date.getMonth() - num); break;
      case 'year': date.setFullYear(date.getFullYear() - num); break;
    }
    return date;
  }
  
  // Handle "this week/month/year"
  if (normalizedInput === 'this week') {
    const date = new Date(today);
    date.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    return date;
  }
  if (normalizedInput === 'this month') {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  }
  if (normalizedInput === 'this year') {
    return new Date(today.getFullYear(), 0, 1);
  }
  
  // Handle month names (e.g., "January", "Jan", "january 2026")
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const monthShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  // "January 2026" or "Jan 2026"
  const monthYearMatch = normalizedInput.match(/^([a-z]+)\s*(\d{4})$/);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1];
    const year = parseInt(monthYearMatch[2], 10);
    let monthIndex = months.findIndex(m => m.startsWith(monthName));
    if (monthIndex === -1) monthIndex = monthShort.indexOf(monthName);
    if (monthIndex !== -1) {
      return new Date(year, monthIndex, 1);
    }
  }
  
  // Just month name (e.g., "January" - assume current year)
  let monthIndex = months.findIndex(m => m.startsWith(normalizedInput));
  if (monthIndex === -1) monthIndex = monthShort.indexOf(normalizedInput);
  if (monthIndex !== -1) {
    return new Date(today.getFullYear(), monthIndex, 1);
  }
  
  // Standard date formats
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return new Date(input + 'T00:00:00');
  }
  
  // MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // DD/MM/YYYY (European format) - only if day > 12
  const dmyMatch = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch && parseInt(dmyMatch[1]) > 12) {
    const [, day, month, year] = dmyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try native Date parsing as fallback
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
};

// Check if input looks like a date query
const isDateQuery = (input: string): boolean => {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/,
    /^(today|yesterday|tomorrow)$/i,
    /^(this|last)\s+(week|month|year)$/i,
    /^last\s+\d+\s+(day|week|month|year)s?$/i,
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    /^(january|february|march|april|may|june|july|august|september|october|november|december)/i,
  ];
  
  return datePatterns.some(pattern => pattern.test(input.trim().toLowerCase()));
};

export default function SmartEventSearch({
  events,
  selectedEventIds,
  onSelectionChange,
  isDark,
  placeholder = "Search events by name or date...",
  disabled = false,
}: SmartEventSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get suggestions based on input
  const suggestions = useMemo(() => {
    if (!inputValue.trim()) {
      // Show all events when empty, sorted by date (newest first)
      return events
        .slice()
        .sort((a, b) => new Date(b.StartDate).getTime() - new Date(a.StartDate).getTime())
        .slice(0, 10);
    }
    
    const searchTerms = inputValue.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    const lastTerm = searchTerms[searchTerms.length - 1] || '';
    
    // Check if it's a date-based search
    if (isDateQuery(lastTerm)) {
      const parsedDate = parseSmartDate(lastTerm);
      if (parsedDate) {
        // Filter events by date
        return events.filter(event => {
          const eventDate = new Date(event.StartDate);
          eventDate.setHours(0, 0, 0, 0);
          
          // For month-based queries, match the entire month
          if (lastTerm.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
              lastTerm.match(/^(this|last)\s+(month|year)$/i)) {
            return eventDate.getMonth() === parsedDate.getMonth() &&
                   eventDate.getFullYear() === parsedDate.getFullYear();
          }
          
          // For "last X days/weeks" queries, show events within that range
          if (lastTerm.match(/^last\s+\d+\s+(day|week|month|year)s?$/i) ||
              lastTerm === 'this week') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return eventDate >= parsedDate && eventDate <= today;
          }
          
          // For specific dates, match exact date
          return eventDate.getTime() === parsedDate.getTime();
        });
      }
    }
    
    // Text-based search (fuzzy matching on title)
    return events.filter(event => {
      const title = event.Title.toLowerCase();
      const status = event.Status.toLowerCase();
      
      // Match if any part of the search term matches
      return lastTerm.split(/\s+/).every(word => 
        title.includes(word) || status.includes(word)
      );
    }).slice(0, 10);
  }, [inputValue, events]);

  // Selected events data
  const selectedEvents = useMemo(() => {
    return events.filter(e => selectedEventIds.includes(e.EventID));
  }, [events, selectedEventIds]);

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  // Handle selecting an event
  const handleSelectEvent = (event: EventData) => {
    if (selectedEventIds.includes(event.EventID)) {
      // Deselect if already selected
      onSelectionChange(selectedEventIds.filter(id => id !== event.EventID));
    } else {
      // Add to selection
      onSelectionChange([...selectedEventIds, event.EventID]);
    }
    
    // Clear the input and close dropdown when an event is selected
    setInputValue('');
    setHighlightedIndex(-1);
    setIsOpen(false);  // Close dropdown after selection
  };

  // Handle removing a selected event
  const handleRemoveEvent = (eventId: string) => {
    onSelectionChange(selectedEventIds.filter(id => id !== eventId));
    inputRef.current?.focus();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && e.key === 'ArrowDown') {
      setIsOpen(true);
      return;
    }
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          handleSelectEvent(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      case 'Backspace':
        if (!inputValue && selectedEventIds.length > 0) {
          // Remove last selected event
          onSelectionChange(selectedEventIds.slice(0, -1));
        }
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format date for display
  const formatEventDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return '#10b981';
      case 'Completed': return '#3b82f6';
      case 'Scheduled': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Main Search Input Container */}
      <div
        className="flex flex-wrap items-center gap-2 min-h-[48px] px-3 py-2 rounded-xl border transition-all"
        style={{
          background: isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isOpen 
            ? DESIGN_TOKENS.colors.brand.orange 
            : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          boxShadow: isOpen ? `0 0 0 3px ${DESIGN_TOKENS.colors.brand.orange}20` : 'none',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        <Search 
          className="w-5 h-5 shrink-0" 
          style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
        />
        
        {/* Selected Events Tags */}
        {selectedEvents.map((event) => (
          <span
            key={event.EventID}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium"
            style={{
              background: DESIGN_TOKENS.colors.brand.orange + '20',
              color: DESIGN_TOKENS.colors.brand.orange,
              border: `1px solid ${DESIGN_TOKENS.colors.brand.orange}40`,
            }}
          >
            <span className="max-w-[150px] truncate">{event.Title}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveEvent(event.EventID);
              }}
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        
        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selectedEvents.length === 0 ? placeholder : 'Add more events...'}
          className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-sm"
          style={{
            color: isDark ? 'white' : 'black',
          }}
        />
        
        {/* Clear All Button */}
        {selectedEventIds.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectionChange([])}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Clear all"
          >
            <X className="w-4 h-4" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }} />
          </button>
        )}
        
        {/* Dropdown Toggle */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 rounded transition-colors"
        >
          <ChevronDown 
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
          />
        </button>
      </div>
      
      {/* Hint Text */}
      <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Try: "January 2026", "last 7 days", "this month"
        </span>
        {selectedEventIds.length > 0 && (
          <span style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
            {selectedEventIds.length} event{selectedEventIds.length !== 1 ? 's' : ''} selected
          </span>
        )}
      </div>
      
      {/* Suggestions Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 mt-2 rounded-xl border shadow-xl overflow-hidden"
          style={{
            background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          {/* Quick Filters */}
          {!inputValue && (
            <div 
              className="px-3 py-2 border-b flex flex-wrap gap-2"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
            >
              <span className="text-xs text-muted-foreground">Quick:</span>
              {['This Week', 'This Month', 'Last 30 Days'].map((quick) => (
                <button
                  key={quick}
                  type="button"
                  onClick={() => {
                    setInputValue(quick.toLowerCase());
                    setHighlightedIndex(-1);
                  }}
                  className="text-xs px-2 py-0.5 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                  style={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
                  }}
                >
                  {quick}
                </button>
              ))}
            </div>
          )}
          
          {/* Suggestions List */}
          {suggestions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-muted-foreground text-sm">No events found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search term or date
              </p>
            </div>
          ) : (
            <div className="py-1">
              {suggestions.map((event, index) => {
                const isSelected = selectedEventIds.includes(event.EventID);
                const isHighlighted = index === highlightedIndex;
                
                return (
                  <button
                    key={event.EventID}
                    type="button"
                    onClick={() => handleSelectEvent(event)}
                    className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                      isHighlighted ? 'bg-gray-100 dark:bg-gray-700' : ''
                    }`}
                    style={{
                      background: isSelected 
                        ? (isDark ? 'rgba(246, 66, 31, 0.15)' : 'rgba(246, 66, 31, 0.1)')
                        : isHighlighted 
                          ? undefined 
                          : 'transparent',
                    }}
                  >
                    {/* Selection Indicator */}
                    <div
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
                      style={{
                        borderColor: isSelected ? DESIGN_TOKENS.colors.brand.orange : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'),
                        background: isSelected ? DESIGN_TOKENS.colors.brand.orange : 'transparent',
                      }}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    
                    {/* Event Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{event.Title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventDate(event.StartDate)}
                      </p>
                    </div>
                    
                    {/* Status Badge */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{
                        background: `${getStatusColor(event.Status)}20`,
                        color: getStatusColor(event.Status),
                      }}
                    >
                      {event.Status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Footer hint */}
          <div 
            className="px-3 py-2 border-t text-xs text-muted-foreground"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
          >
            <span className="opacity-60">↑↓ Navigate</span>
            <span className="mx-2 opacity-40">•</span>
            <span className="opacity-60">↵ Select</span>
            <span className="mx-2 opacity-40">•</span>
            <span className="opacity-60">Esc Close</span>
          </div>
        </div>
      )}
    </div>
  );
}
