'use client';

/**
 * Drawing a forgetting curve.
 *
 * The server sends stability and the session history; the shape is computed
 * here, because it is a function of two numbers and shipping a hundred sampled
 * points down the wire to draw a smooth exponential would be silly.
 *
 * Everything in this file is about the SHAPE. No component built on it prints
 * a strength as a percentage, because the model does not measure memory — it
 * models it. The curve says "this one has been left longest relative to how
 * well you had it", which is true. A number would say something that is not.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';

export const RETRIEVABILITY = (days, stability) => Math.exp(-Math.max(0, days) / Math.max(0.5, stability));

export function useRetention() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api.retention());
      setStatus('ready');
      setError('');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, status, error, reload: load };
}

/* --------------------------------------------------------------------------
   The path
   -------------------------------------------------------------------------- */

const DAY = 864e5;

/**
 * The real sawtooth: strength climbing at every session and decaying between,
 * from the first session to `aheadDays` past today.
 *
 * Drawn as the actual history rather than one smooth curve from the last
 * session, because the whole argument of the model is that the *pattern* of
 * sessions is what makes something durable — a single decaying curve hides
 * exactly the thing worth seeing.
 */
export function buildPath(topic, { width, height, aheadDays = 21, now = Date.now() }) {
  const steps = (topic.steps || []).map((s) => ({ at: new Date(s.at).getTime(), stability: s.stability }));
  if (!steps.length) return null;

  const from = steps[0].at;
  const to = now + aheadDays * DAY;
  const span = Math.max(DAY, to - from);

  const x = (t) => ((t - from) / span) * width;
  const y = (r) => (1 - r) * height;

  const points = [];
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    const next = steps[i + 1]?.at ?? to;

    // The rebuild: strength jumps to 1 the moment a session happens.
    points.push({ t: step.at, r: 1, rebuild: i > 0 });

    // The decay to the next session, sampled enough to look like a curve.
    const segment = next - step.at;
    const samples = Math.max(2, Math.min(40, Math.round(segment / DAY)));
    for (let s = 1; s <= samples; s += 1) {
      const t = step.at + (segment * s) / samples;
      points.push({ t, r: RETRIEVABILITY((t - step.at) / DAY, step.stability) });
    }
  }

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ');

  const last = steps[steps.length - 1];
  const nowR = RETRIEVABILITY((now - last.at) / DAY, last.stability);

  return {
    d,
    /* Where "now" is on the curve, so the head can be drawn as a position on
       the line rather than as a separate number beside it. */
    now: { x: x(now), y: y(nowR), r: nowR },
    /* Everything past today is a projection, so it is drawn differently — a
       forecast that looks like history is a lie about what is known. */
    nowX: x(now),
    sessions: steps.map((s) => ({ x: x(s.at), y: y(1) })),
    width,
    height,
  };
}

/* --------------------------------------------------------------------------
   Words
   -------------------------------------------------------------------------- */

/** "9 days ago", "yesterday", "today". Never "9.2 days ago". */
export function agoLabel(days) {
  const d = Math.round(days);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

/**
 * How a strength should be spoken about.
 *
 * Words, not numbers, everywhere it is user-facing. The model is a guess with
 * a decimal point on it, and "62%" claims a precision that does not exist —
 * whereas "slipping" is exactly as precise as the thing being described.
 */
export function standingOf(strength, thresholds) {
  if (strength >= 0.85) return { tone: 'held', label: 'Fresh' };
  if (strength >= (thresholds?.revise ?? 0.6)) return { tone: 'neutral', label: 'Holding' };
  if (strength >= (thresholds?.faded ?? 0.35)) return { tone: 'warning', label: 'Slipping' };
  return { tone: 'danger', label: 'Gone cold' };
}

/** "about a fortnight before this is half gone." */
export function halfLifeLabel(days) {
  if (days == null) return null;
  if (days < 2) return 'a day or two';
  if (days < 10) return `about ${Math.round(days)} days`;
  if (days < 20) return 'about a fortnight';
  if (days < 45) return `about ${Math.round(days / 7)} weeks`;
  return `about ${Math.round(days / 30)} months`;
}
