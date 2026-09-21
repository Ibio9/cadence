/*
 * A sitting is a route without a shell, for the same reason Focus is: for the
 * fifteen minutes you are looking at one prompt, nothing else on the screen is
 * doing anything useful.
 */
import SittingScreen from '../../../src/screens/interview/SittingScreen';

export const metadata = { title: 'Sitting · Cadence' };

export default function SittingPage({ params }) {
  return <SittingScreen id={params.id} />;
}
