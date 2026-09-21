'use client';

/**
 * The one orchestrated moment: a block opening into Focus.
 *
 * Focus is a route, not a panel, so by default it would arrive the way any
 * page does — the day disappears and something else is there. That reads as a
 * modal appearing over the day. What it should read as is the block you
 * touched expanding into the surface you work on.
 *
 * So the row measures itself on the way out — its own box, and its title's box
 * — and hands both forward. Focus picks them up on mount and plays four things
 * against each other:
 *
 *   1. A ghost rectangle drawn at exactly the row's bounds, growing to exactly
 *      the header's. Width and height, not a scale: the block's real dimensions
 *      becoming the page's. It carries the substrate wash and the glow, so what
 *      grows is the lit block itself rather than an outline of it.
 *   2. The title, travelling from where it was standing to where it lands,
 *      correcting for the size change so the two never appear at once at
 *      different sizes.
 *   3. The session rail unrolling from the left, a beat behind — the vertical
 *      rail the row was hanging off, turning horizontal.
 *   4. Everything else, arriving last and barely moving.
 *
 * Everything else in the app moves at 140ms or not at all. This is the only
 * thing in Cadence that is allowed to be a performance.
 */

const KEY = 'cadence_open_block';

/** Anything older than this is a page the person navigated to some other way. */
const FRESH_MS = 1500;

/** The whole moment, in ms. Mirrors --dur-open in tokens.css. */
const OPEN = 520;

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Click handler for a row that links into Focus. It does not preventDefault:
 * the link navigates normally and this only leaves a note behind, so a middle
 * click, a new tab and a keyboard activation all still behave like links.
 */
export function openBlock(event) {
  try {
    const el = event.currentTarget;
    const row = el?.getBoundingClientRect?.();
    if (!row) return;
    const title = el.querySelector('.cd-railrow__title')?.getBoundingClientRect();
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        row: { top: row.top, left: row.left, width: row.width, height: row.height },
        title: title ? { top: title.top, left: title.left, height: title.height } : null,
        // Whether the row was the lit one. A block you open from the middle of
        // tomorrow should not arrive glowing.
        lit: el.classList.contains('is-now'),
        at: Date.now(),
      }),
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
  if (!root || reduced() || typeof root.animate !== 'function') return;

  const from = takeRect();
  if (!from) return;

  const head = root.querySelector('.cd-focus__head');
  const title = root.querySelector('.cd-focus__title');
  const rail = root.querySelector('.cd-sessionrail');
  const rest = root.querySelector('.cd-focus__grid');
  if (!head) return;

  const ease = 'cubic-bezier(0.32, 0.72, 0, 1)';

  /* 1 — the surface. The ghost starts as the row and ends as the header's
     footprint, padded out to the measure the page actually reads at. Because
     both rectangles are measured, this is the block's own dimensions growing
     rather than a box being scaled into roughly the right shape. */
  const to = head.getBoundingClientRect();
  const pad = 12;
  const ghost = document.createElement('div');
  ghost.className = 'cd-openghost';
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    top: `${from.row.top}px`,
    left: `${from.row.left}px`,
    width: `${from.row.width}px`,
    height: `${from.row.height}px`,
  });

  // The rail segment the row was hanging off comes with it, so the line is
  // continuous through the move instead of vanishing and reappearing.
  if (from.lit) {
    const seg = document.createElement('span');
    seg.className = 'cd-openghost__rail';
    seg.style.left = '0px';
    ghost.appendChild(seg);
  }

  document.body.appendChild(ghost);

  const grow = ghost.animate(
    [
      { transform: 'translate(0, 0)', width: `${from.row.width}px`, height: `${from.row.height}px`, opacity: 1 },
      {
        transform: `translate(${to.left - pad - from.row.left}px, ${to.top - pad - from.row.top}px)`,
        width: `${to.width + pad * 2}px`,
        height: `${to.height + pad * 2}px`,
        opacity: 0,
      },
    ],
    { duration: OPEN, easing: ease, fill: 'forwards' },
  );
  const drop = () => ghost.remove();
  grow.addEventListener('finish', drop);
  grow.addEventListener('cancel', drop);
  // A tab backgrounded mid-animation never fires finish. The ghost is inert,
  // but it should not outlive the moment on a page you come back to.
  setTimeout(drop, OPEN + 400);

  /* 2 — the title. It travels from the row's title to the page's title, and
     scales from the size it was to the size it is now, so at no point are
     there two different titles in two different places. */
  if (title && from.title) {
    const dest = title.getBoundingClientRect();
    const scale = from.title.height && dest.height ? from.title.height / dest.height : 0.7;
    title.animate(
      [
        {
          transform: `translate(${from.title.left - dest.left}px, ${from.title.top - dest.top}px) scale(${scale})`,
          opacity: 0.55,
        },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ],
      { duration: OPEN, easing: ease, fill: 'backwards', composite: 'replace' },
    );
    title.style.transformOrigin = 'left top';
  }

  /* 3 — the rail unrolls under it, a beat behind. */
  rail?.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
    duration: OPEN,
    delay: 80,
    easing: ease,
    fill: 'backwards',
  });

  /* 4 — everything else arrives last and barely moves. */
  rest?.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], {
    duration: 300,
    delay: 200,
    easing: ease,
    fill: 'backwards',
  });
}
