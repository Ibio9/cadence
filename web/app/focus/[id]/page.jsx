import FocusScreen from '../../../src/screens/FocusScreen';

export const metadata = { title: 'Focus — Cadence' };

/**
 * /focus/<block id>
 *
 * A route rather than a panel, so the address bar holds which block is open.
 * Refresh it, bookmark it, send it to yourself: it comes back to the same
 * block with the same clock, because the clock is on the server.
 */
export default function FocusPage({ params }) {
  return <FocusScreen id={params.id} />;
}
