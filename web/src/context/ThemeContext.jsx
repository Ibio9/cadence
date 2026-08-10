'use client';

/**
 * Theme state for Cadence.
 *
 * Resolution order, highest first:
 *   1. the stored user preference (the app has no server side preference
 *      store, so localStorage is the persistence layer it already uses)
 *   2. localStorage
 *   3. light-blue
 *
 * The attribute is written to <html> by the inline script in app/layout.jsx
 * before first paint, so there is no flash. This provider re reads the same
 * key on mount and keeps the attribute in sync afterwards.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_STORAGE_KEY = 'cadence_theme';
export const DEFAULT_THEME = 'light-blue';

export const THEMES = [
  {
    id: 'light-blue',
    name: 'Light blue',
    description: 'Warm cream ground, cobalt accent. The default.',
  },
  {
    id: 'dark-blue',
    name: 'Dark blue',
    description: 'Warm neutral darks, accent lifted for contrast.',
  },
];

const THEME_IDS = THEMES.map((t) => t.id);

const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    // Tolerate both a bare string and the JSON encoded value the earlier
    // build wrote, so an existing preference is not thrown away.
    const value = raw.startsWith('"') ? JSON.parse(raw) : raw;
    if (THEME_IDS.includes(value)) return value;
    if (value === 'dark') return 'dark-blue';
    if (value === 'light') return 'light-blue';
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  // Server render and first client render both use the default so hydration
  // matches. The inline head script has already painted the real theme.
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [ready, setReady] = useState(false);
  const [persistError, setPersistError] = useState(false);

  useEffect(() => {
    const resolved = readStoredTheme();
    setThemeState(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
    setReady(true);
  }, []);

  const setTheme = useCallback((next) => {
    if (!THEME_IDS.includes(next)) return;
    setThemeState(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      setPersistError(false);
    } catch {
      // The theme still applies for this session. Settings says so plainly
      // rather than failing silently.
      setPersistError(true);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark-blue' ? 'light-blue' : 'dark-blue');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, themes: THEMES, ready, persistError }),
    [theme, setTheme, toggleTheme, ready, persistError],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/**
 * The pre paint script. Kept here so the token list and the storage key have
 * one home. Injected in app/layout.jsx head.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var r=localStorage.getItem(k);var v=r&&r.charAt(0)==='"'?JSON.parse(r):r;var ok=${JSON.stringify(THEME_IDS)};if(v==='dark')v='dark-blue';if(v==='light')v='light-blue';document.documentElement.setAttribute('data-theme',ok.indexOf(v)>-1?v:${JSON.stringify(DEFAULT_THEME)});}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;
