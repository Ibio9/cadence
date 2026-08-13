'use client';

/**
 * The one provider every route needs: toasts, so any screen can report an
 * outcome. It lives above the shell so Focus, which has no shell, still has it.
 *
 * There is no theme provider. Cadence has one substrate, declared in
 * tokens.css, and nothing at runtime can change it.
 */

import { ToastProvider } from '../src/components/ui';

export function Providers({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}

export default Providers;
