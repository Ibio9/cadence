'use client';

/**
 * Theme state for Cadence.
 *
 * Two themes, named for the substrate rather than for a hue: the light is
 * printed on warm paper, the dark is printed on a deep warm neutral. The mint
 * emission is byte for byte identical in both, because the dark theme inverts
 * the substrate, not the logic.
 *
 * The attribute is written to <html> by the inline script in app/layout.jsx
 * before first paint, so there is no flash. This provider re-reads the same
 * key on mount and keeps the attribute in sync afterwards.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_STORAGE_KEY = 'cadence_theme';
export const DEFAULT_THEME = 'light';

export const THEMES = [
  { id: 'light', name: 'Light', description: 'Warm paper. The default.' },
  { id: 'dark', name: 'Dark', description: 'Deep warm neutral, the same mint light.' },
];

const THEME_IDS = THEMES.map((t) => t.id);

/**
 * Values written by earlier builds, mapped forward. The old names described a
 * hue that is no longer in the palette, but a stored preference should still
 * mean what the person meant when they set it.
 */
const LEGACY = { 'light-blue': 'light', 'dark-blue': 'dark' };

const ThemeContext = createContext(null);

function readStoredTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    // Tolerate both a bare string and the JSON encoded value an earlier build
    // wrote, so an existing preference is not thrown away.
    const value = raw.startsWith('"') ? JSON.parse(raw) : raw;
    if (THEME_IDS.includes(value)) return value;
    return LEGACY[value] || DEFAULT_THEME;
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
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
 * The pre-paint script. Kept here so the theme list, the legacy mapping and
 * the storage key have one home. Injected in app/layout.jsx head.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var r=localStorage.getItem(k);var v=r&&r.charAt(0)==='"'?JSON.parse(r):r;var legacy=${JSON.stringify(LEGACY)};if(legacy[v])v=legacy[v];var ok=${JSON.stringify(THEME_IDS)};document.documentElement.setAttribute('data-theme',ok.indexOf(v)>-1?v:${JSON.stringify(DEFAULT_THEME)});}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;
