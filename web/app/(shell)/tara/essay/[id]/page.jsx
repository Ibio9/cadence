'use client';

import EssayScreen from '../../../../../src/screens/tara/EssayScreen';

/** /tara/essay/<id> — one marked essay, linkable so a report can be reopened. */
export default function TaraEssayPage({ params }) {
  return <EssayScreen id={params.id} />;
}
