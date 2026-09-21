'use client';

import ModuleScreen from '../../../../src/screens/tara/ModuleScreen';

/** /tara/<module> — ct, ps or writing. */
export default function TaraModulePage({ params }) {
  return <ModuleScreen moduleId={params.module} />;
}
