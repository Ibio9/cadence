'use client';

/**
 * The one orchestrated moment: a block opening into Focus.
 *
 * Focus is a route, not a panel, so by default it would arrive the way any
 * page does — the day disappears and something else is there. That reads as a
 * modal appearing over the day. What it should read as is the block you
 * touched expanding into the surface you work on.
 *
 * So the row measures itself on the way out and hands the rectangle forward.
 * Focus picks it up on mount and plays the block into place from exactly
 * where it was standing: a first-last-invert, run on the Web Animations API,
 * with the session rail unrolling underneath it.
 *
 * Everything else in the app moves at 140ms or not at all. This is the only
 * thing in Cadence that is allowed to be a performance.
 */

const KEY = 'cadence_open_block';

/** Anything older than this is a page the person navigated to some other way. */
const FRESH_MS = 1500;

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Click handler for a row that links into Focus. It does not preventDefault:
 * the link navigates normally and this only leaves a note behind, so a middle
 * click, a new tab and a keyboard activation all still behave like links.
 */
export function openBlock(event) {
  try {
    const row = event.currentTarget?.getBoundingClientRect?.();
    if (!row) return;
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ top: row.top, left: row.left, width: row.width, at: Date.now() }),
    );
  } catch {
    // A blocked sessionStorage costs the animation and nothing else.
  }
}

function takeRect() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const rect = JSON.parse(raw);
    return Date.now() - rect.at < FRESH_MS ? rect : null;
  } catch {
    return null;
  }
}

/**
 * Play the block into place. Called once, from Focus, after the real content
 * has rendered — so the finish position is measured rather than guessed and
 * nothing shifts when the animation ends.
 */
export function playOpen(root) {
  if (!root || reduced()) return;

  const rect = takeRect();
  if (!rect) return;

  const head = root.querySelector('.cd-focus__head');
  const rail = root.querySelector('.cd-sessionrail');
  const rest = root.querySelector('.cd-focus__grid');
  if (!head) return;

  const to = head.getBoundingClientRect();
  const dx = rect.left - to.left;
  const dy = rect.top - to.top;

  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';

  // The title travels from where the row was standing and settles into place.
  head.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(0.92)`, opacity: 0.4 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
    ],
    { duration: 420, easing: ease, fill: 'backwards' },
  );

  // The rail unrolls under it, a beat behind.
  rail?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
    duration: 480,
    delay: 60,
    easing: ease,
    fill: 'backwards',
  });

  // Everything else arrives last and barely moves.
  rest?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], {
    duration: 300,
    delay: 160,
    easing: ease,
    fill: 'backwards',
  });
}
