/**
 * Retention curves.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THIS IS A MODEL, NOT A MEASUREMENT.
 *
 * Nothing here observes whether you actually remember anything. It observes
 * when you worked on something, for how long, and — where there is a score —
 * how it went, and it runs a forgetting curve over those events. The shape is
 * real; the number on the y-axis is a guess with a decimal point on it.
 *
 * So every consumer of this file is expected to use it for ORDERING and never
 * to display a percentage as a fact. "This is the one you have left longest
 * relative to how well you had it" is a claim this supports. "You remember 62%
 * of thermodynamics" is not, and no screen says it.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * The model
 *
 *   Retrievability decays exponentially from the last session:
 *
 *       R(t) = exp(-t / S)
 *
 *   where t is days since, and S — stability — is how many days it takes to
 *   fall to about 37%. One session gives a small S. Every session after that
 *   multiplies it, and this is where the spacing effect lives:
 *
 *       S ← S · (1 + GAIN · (1 − R_at_review) · quality)
 *
 *   The (1 − R) term is the whole point. Reviewing something you still have
 *   fresh buys almost nothing; reviewing it when it has half gone buys a lot.
 *   That is why three sessions spread over three weeks leave a topic far more
 *   durable than three sessions in one afternoon, and why one session three
 *   weeks ago leaves almost nothing.
 *
 *   Worked, with the constants below:
 *
 *     one session, 21 days ago         → R ≈ 0.005
 *     three sessions, days 0/7/14      → R ≈ 0.66 on day 21
 *
 *   Same three sessions, same total hours. The spacing does the work.
 */

import { prisma } from './db.js';
import { ALL_SUBCATEGORIES } from './tara/taxonomy.js';

/** Days to fall to ~37% after a single session with nothing before it. */
const BASE_STABILITY = 4;

/** How hard a well-spaced review multiplies stability. */
const GAIN = 1.6;

/** A session shorter than this counts for less; longer buys diminishing more. */
const FULL_SESSION_MINUTES = 45;

/** Below this, a topic is what you should be revising. */
export const REVISE_BELOW = 0.6;

/** Below this, the day spine marks a block carrying it. */
export const FADED_BELOW = 0.35;

const DAY = 864e5;
const daysBetween = (a, b) => Math.max(0, (b - a) / DAY);

/* --------------------------------------------------------------------------
   The curve
   -------------------------------------------------------------------------- */

/** Retrievability at `days` since the last session, given stability `S`. */
export const retrievability = (days, S) => Math.exp(-Math.max(0, days) / Math.max(0.5, S));

/**
 * Run the sessions through the model in order and return the stability after
 * each one, so a screen can draw the real sawtooth — the rebuild at every
 * session and the decay between — rather than one smooth curve that pretends
 * the topic was learned once.
 */
export function runCurve(sessions) {
  const steps = [];
  let S = 0;
  let prev = null;

  for (const s of [...sessions].sort((a, b) => a.at - b.at)) {
    if (prev == null) {
      S = BASE_STABILITY * s.quality;
    } else {
      const gap = daysBetween(prev, s.at);
      const rAtReview = retrievability(gap, S);
      // A session on the same day as the last is not a second review — it is
      // the same review continuing, so it adds effort but no spacing gain.
      S = S * (1 + GAIN * (1 - rAtReview) * s.quality);
    }
    prev = s.at;
    steps.push({ at: s.at, stability: S });
  }

  return { stability: S, lastAt: prev, steps };
}

/**
 * How much one session is worth. Two things move it: how long you were at it,
 * and — where anything was scored — whether it went well. Both are clamped,
 * because a four-hour session is not five times a fifty-minute one and a bad
 * session still counts for something.
 */
function quality({ minutes = FULL_SESSION_MINUTES, accuracy = null }) {
  const byLength = Math.min(1.4, Math.max(0.4, minutes / FULL_SESSION_MINUTES));
  if (accuracy == null) return byLength;
  // Getting them right consolidates; getting them wrong is still exposure.
  return byLength * (0.55 + 0.75 * accuracy);
}

/* --------------------------------------------------------------------------
   What counts as a topic
   -------------------------------------------------------------------------- */

/**
 * A topic is a thing you come back to, and the honest key for that is the
 * block's own title. Two blocks called "Thermodynamics" three weeks apart are
 * the same topic; nobody had to tag anything, and it works backwards over
 * every day already in the database.
 */
export const topicKey = (title) =>
  (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

/**
 * Every topic, with its curve.
 *
 * Derived rather than tracked. There is no retention table and nothing writes
 * a "topic touched" row — the sessions are read out of the blocks you actually
 * held and the TARA questions you actually answered. That means it is right
 * about history it was not present for, and it cannot drift out of step with
 * the thing it describes.
 */
export async function loadRetention({ now = Date.now() } = {}) {
  const [blocks, projects, attempts, questions] = await Promise.all([
    prisma.block.findMany({
      where: { status: 'done' },
      select: { title: true, projectId: true, date: true, elapsedSec: true, startMin: true, endMin: true },
    }),
    prisma.project.findMany({ orderBy: { order: 'asc' } }),
    prisma.taraAttempt.findMany({ select: { questionId: true, correct: true, seconds: true, createdAt: true } }),
    prisma.taraQuestion.findMany({ select: { id: true, module: true, subcategory: true } }),
  ]);

  const topics = new Map();
  const touch = (key, patch, session) => {
    if (!topics.has(key)) topics.set(key, { key, sessions: [], ...patch });
    topics.get(key).sessions.push(session);
  };

  /* ---- blocks you held ---- */
  for (const b of blocks) {
    const key = topicKey(b.title);
    if (!key) continue;
    // A block's date is the day it belonged to; the clock is what you actually
    // put in. Where the clock was never started, fall back to the block's own
    // length rather than dropping the session — it was held, so it happened.
    const minutes = b.elapsedSec > 0 ? b.elapsedSec / 60 : Math.max(0, b.endMin - b.startMin);
    touch(
      `block:${b.projectId}:${key}`,
      { kind: 'block', label: b.title, projectId: b.projectId },
      { at: new Date(`${b.date}T12:00:00`).getTime(), quality: quality({ minutes }) },
    );
  }

  /* ---- TARA subcategories ---- */
  const qById = Object.fromEntries(questions.map((q) => [q.id, q]));
  const byDay = new Map();
  for (const a of attempts) {
    const q = qById[a.questionId];
    if (!q) continue;
    const day = new Date(a.createdAt).toISOString().slice(0, 10);
    const k = `${q.module}:${q.subcategory}:${day}`;
    if (!byDay.has(k)) {
      byDay.set(k, { module: q.module, subcategory: q.subcategory, day, asked: 0, right: 0, seconds: 0 });
    }
    const cell = byDay.get(k);
    cell.asked += 1;
    cell.seconds += a.seconds || 0;
    if (a.correct) cell.right += 1;
  }

  const subLabel = Object.fromEntries(
    ALL_SUBCATEGORIES.map((s) => [`${s.module}:${s.id}`, `${s.moduleName} · ${s.name}`]),
  );

  for (const cell of byDay.values()) {
    const id = `${cell.module}:${cell.subcategory}`;
    touch(
      `tara:${id}`,
      {
        kind: 'tara',
        label: subLabel[id] || id,
        projectId: 'tara',
        module: cell.module,
        subcategory: cell.subcategory,
      },
      {
        at: new Date(`${cell.day}T12:00:00`).getTime(),
        quality: quality({ minutes: cell.seconds / 60, accuracy: cell.right / cell.asked }),
      },
    );
  }

  /* ---- run the model ---- */
  const out = [];
  for (const t of topics.values()) {
    const { stability, lastAt, steps } = runCurve(t.sessions);
    if (lastAt == null) continue;
    const since = daysBetween(lastAt, now);
    out.push({
      key: t.key,
      kind: t.kind,
      label: t.label,
      projectId: t.projectId,
      module: t.module ?? null,
      subcategory: t.subcategory ?? null,
      sessions: t.sessions.length,
      lastAt: new Date(lastAt).toISOString(),
      daysSince: Math.round(since * 10) / 10,
      stability: Math.round(stability * 10) / 10,
      /** Where it sits on its own curve, right now. Ordering, not a fact. */
      strength: Math.round(retrievability(since, stability) * 1000) / 1000,
      /** Days from the last session to 50%. The honest way to say "how long this lasts". */
      half: Math.round(stability * Math.LN2 * 10) / 10,
      /** The sawtooth: stability after each session, for drawing. */
      steps: steps.map((s) => ({ at: new Date(s.at).toISOString(), stability: Math.round(s.stability * 10) / 10 })),
    });
  }

  out.sort((a, b) => a.strength - b.strength);

  return {
    topics: out,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    thresholds: { revise: REVISE_BELOW, faded: FADED_BELOW },
    model: {
      baseStability: BASE_STABILITY,
      gain: GAIN,
      /* Sent so the screen can say it in the person's own interface rather
         than only in a comment nobody reads. */
      caveat:
        'This is a model, not a measurement. Nothing here checks whether you actually remember anything — it runs a forgetting curve over when you worked and how it went. Use the order, not the number.',
    },
  };
}

/* --------------------------------------------------------------------------
   The two things that read it
   -------------------------------------------------------------------------- */

/** What needs revising, worst first. Used by Jarvis and the TARA weakness set. */
export function decayed(topics, { limit = 8, below = REVISE_BELOW } = {}) {
  return topics
    .filter((t) => t.strength < below && t.sessions > 0)
    // Something you have built up and then let go is a better use of an hour
    // than something you touched once and never returned to — the second is a
    // new topic wearing a decayed one's clothes.
    .sort((a, b) => b.sessions - a.sessions || a.strength - b.strength)
    .slice(0, limit);
}

/** Retention for one topic key, or null when it has never been worked. */
export function forTopic(topics, { title, projectId }) {
  const key = `block:${projectId}:${topicKey(title)}`;
  return topics.find((t) => t.key === key) || null;
}
