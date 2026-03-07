/**
 * ThemeContext - Centralized theme state management
 * 
 * Provides:
 * - isDark state for dark/light mode
 * - toggleTheme function
 * - Persists preference to encrypted localStorage (persistent across sessions)
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = 'ysp_theme_preference';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(() => {
    try {
      const stored = secureGetItem(THEME_KEY, { persistent: true });
      if (stored !== null) {
        return stored === 'dark';
      }
      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      secureSetItem(THEME_KEY, isDark ? 'dark' : 'light', { persistent: true });
    } catch {
      // Ignore storage errors
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  const setTheme = useCallback((dark: boolean) => {
    setIsDark(dark);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
