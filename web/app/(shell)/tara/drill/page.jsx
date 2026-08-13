'use client';

import { Suspense } from 'react';
import DrillScreen from '../../../../src/screens/tara/DrillScreen';

// useSearchParams needs a Suspense boundary to prerender, and the drill is
// entirely defined by its query string.
export default function TaraDrillPage() {
  return (
    <Suspense fallback={null}>
      <DrillScreen />
    </Suspense>
  );
}
