'use client';

/**
 * The two providers every route needs: the theme (so the substrate is right
 * before anything paints) and toasts (so any screen can report an outcome).
 * They live above the shell so Focus, which has no shell, still has both.
 */

import { ToastProvider } from '../src/components/ui';
import { ThemeProvider } from '../src/context/ThemeContext';

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

export default Providers;
