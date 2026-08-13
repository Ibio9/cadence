'use client';

/**
 * /dev/ui
 *
 * Every primitive in every state on one page. Gated behind
 * NEXT_PUBLIC_ENABLE_DEV_UI so it never ships enabled by accident. Set
 * NEXT_PUBLIC_ENABLE_DEV_UI=true in web/.env.local to view it.
 *
 * One pass, not two: there is one substrate now, so a gallery that rendered
 * the same components twice was showing the same thing twice.
 */

import Gallery from '../../../src/components/dev/Gallery';
import { ToastProvider } from '../../../src/components/ui';

const ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEV_UI === 'true';

export default function DevUiPage() {
  if (!ENABLED) {
    return (
      <main className="cd-page">
        <div className="cd-state">
          <h1 className="cd-state__title">The gallery is switched off</h1>
          <p className="cd-state__body">
            Set NEXT_PUBLIC_ENABLE_DEV_UI to true in web/.env.local, then restart the dev server.
          </p>
        </div>
      </main>
    );
  }

  return (
    <ToastProvider>
      <main>
        <h1 className="sr-only">Cadence primitive gallery</h1>
        <Gallery label="Every primitive, every state, one substrate." />
      </main>
    </ToastProvider>
  );
}
