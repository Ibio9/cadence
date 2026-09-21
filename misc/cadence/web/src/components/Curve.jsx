'use client';

/**
 * A forgetting curve, drawn.
 *
 * Thin luminous lines and nothing else: no axes, no gridlines, no legend, no
 * tooltip, no rounded plot area. A chart library would supply all six, and
 * five of them would be brighter than the data. What is wanted is the shape of
 * one line falling away on black.
 *
 * The line is drawn twice: solid up to now, and faint past it. Everything
 * after today is a projection of a model, and a forecast that looks like
 * history is a lie about what is known.
 */

import { buildPath } from '../lib/retention';

export function Curve({ topic, width = 240, height = 56, aheadDays = 21, className = '', lit = false }) {
  const path = buildPath(topic, { width, height, aheadDays });
  if (!path) return null;

  const clipPast = `past-${topic.key.replace(/[^a-z0-9]/gi, '')}`;
  const clipAhead = `ahead-${topic.key.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`cd-curve ${className}`}
      role="img"
      aria-label={`${topic.label}: ${topic.sessions} ${topic.sessions === 1 ? 'session' : 'sessions'}, last worked ${Math.round(topic.daysSince)} days ago`}
    >
      <defs>
        <clipPath id={clipPast}>
          <rect x="0" y="0" width={Math.max(0, path.nowX)} height={height} />
        </clipPath>
        <clipPath id={clipAhead}>
          <rect x={Math.max(0, path.nowX)} y="0" width={width} height={height} />
        </clipPath>
      </defs>

      {/* The floor: where a topic stops being worth calling remembered. A
          hairline rather than a gridline — one reference, not a grid. */}
      <line x1="0" y1={height * 0.4} x2={width} y2={height * 0.4} className="cd-curve__floor" />

      <path d={path.d} className="cd-curve__line" clipPath={`url(#${clipPast})`} />
      <path d={path.d} className="cd-curve__ahead" clipPath={`url(#${clipAhead})`} />

      {/* Each session, where the line was pushed back up. */}
      {path.sessions.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r="1.6" className="cd-curve__session" />
      ))}

      {/* Where you are now: a position on the line, not a number beside it. */}
      <circle cx={path.now.x} cy={path.now.y} r="3" className={lit ? 'cd-curve__now is-lit' : 'cd-curve__now'} />
    </svg>
  );
}

export default Curve;
