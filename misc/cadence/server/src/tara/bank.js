/**
 * The bank builds itself.
 *
 * Pressing "generate" before you can drill is a tax on the wrong person. The
 * bank is the durable asset in this whole section, so it stocks itself on first
 * boot and quietly tops itself up afterwards, and the only thing the interface
 * has to do is say how far along it is.
 *
 * Two jobs, one queue:
 *
 *   SEED    Every subcategory reaches SEED_TARGET questions. Runs once, on the
 *           first boot with an empty bank, and resumes by itself if the process
 *           restarts halfway — because the target is measured against the
 *           database rather than tracked in memory, an interrupted seed is
 *           simply a smaller seed next time.
 *
 *   TOP UP  A subcategory whose *unseen* stock falls below TOPUP_FLOOR gets
 *           more written. Unseen is the right measure: a hundred questions you
 *           have already answered twice are worth nothing to drill against, so
 *           counting the bank rather than the usable part of it would let the
 *           section run dry while reporting that it was full.
 *
 * Everything runs off the request path. A generation is a minute of model time
 * and the person asking for a drill should never wait on one.
 */

import { prisma } from '../db.js';
import { generateQuestions } from './generate.js';
import { ALL_SUBCATEGORIES } from './taxonomy.js';

/** What a subcategory needs before the section is worth opening. */
export const SEED_TARGET = 15;

/** Below this many *unseen* questions, a subcategory is quietly restocked. */
export const TOPUP_FLOOR = 10;

/** Restocking takes it comfortably clear of the floor, not just over it. */
export const TOPUP_TARGET = 18;

/** Questions per model call. Small batches keep a failure cheap. */
const BATCH = 5;

/**
 * How many calls run at once. Three is a compromise: one is too slow to finish
 * a 285-question seed in a sitting, and a dozen buys nothing because the
 * bottleneck is the model rather than the process.
 */
const CONCURRENCY = 3;

/** A batch that comes back unusable is retried this many times, then skipped. */
const MAX_RETRIES = 2;

/** The MCQ leaves only. The writing task has prompts, not questions. */
const LEAVES = ALL_SUBCATEGORIES.filter((s) => s.module === 'ct' || s.module === 'ps');

/* --------------------------------------------------------------------------
   State
   -------------------------------------------------------------------------- */

/**
 * One build at a time, held in memory. It is deliberately not persisted: the
 * bank is the state, and a status object that outlived the process it describes
 * would be a second source of truth that could only ever be wrong.
 */
const build = {
  running: false,
  kind: null,            // 'seed' | 'topup'
  startedAt: null,
  finishedAt: null,
  target: 0,             // questions this build set out to write
  written: 0,
  rejected: 0,
  /** Subcategory keys still queued or in flight, so the UI can name one. */
  pending: [],
  active: [],
  /** [{ key, name, problem }] — kept so a silent failure is impossible. */
  failures: [],
  lastError: null,
};

const keyOf = (s) => `${s.module}:${s.id}`;
const byKey = Object.fromEntries(LEAVES.map((s) => [keyOf(s), s]));

/* --------------------------------------------------------------------------
   Counting
   -------------------------------------------------------------------------- */

/**
 * Per subcategory: how many live questions exist, and how many of those have
 * never been answered. Two queries for the whole taxonomy rather than one per
 * leaf, because this runs on every drill request.
 */
export async function stock() {
  const [rows, attempts] = await Promise.all([
    prisma.taraQuestion.findMany({
      where: { retired: false, module: { in: ['ct', 'ps'] } },
      select: { id: true, module: true, subcategory: true },
    }),
    prisma.taraAttempt.findMany({ select: { questionId: true }, distinct: ['questionId'] }),
  ]);

  const seen = new Set(attempts.map((a) => a.questionId));
  const out = {};
  for (const s of LEAVES) out[keyOf(s)] = { total: 0, unseen: 0, module: s.module, id: s.id, name: s.name };
  for (const q of rows) {
    const cell = out[`${q.module}:${q.subcategory}`];
    if (!cell) continue;
    cell.total += 1;
    if (!seen.has(q.id)) cell.unseen += 1;
  }
  return out;
}

/** What a seed still owes: every subcategory short of SEED_TARGET. */
function seedGaps(counts) {
  return LEAVES.map((s) => ({ sub: s, want: SEED_TARGET - counts[keyOf(s)].total }))
    .filter((g) => g.want > 0);
}

/** What a top-up owes: every subcategory whose usable stock is under the floor. */
function topupGaps(counts) {
  return LEAVES.map((s) => ({ sub: s, want: TOPUP_TARGET - counts[keyOf(s)].unseen }))
    .filter((g) => counts[keyOf(g.sub)].unseen < TOPUP_FLOOR && g.want > 0);
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

/**
 * One batch into one subcategory. Returns what actually landed.
 *
 * The recent stems are shown to the model so it writes something new rather
 * than a variation on the last batch — without that, a 15-question seed
 * produces five questions and ten paraphrases of them.
 */
async function writeBatch(sub, count) {
  const recent = await prisma.taraQuestion.findMany({
    where: { module: sub.module, subcategory: sub.id },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { stem: true, passage: true },
  });
  const avoid = recent.map((r) => `${r.passage.slice(0, 90)} … ${r.stem}`.replace(/\s+/g, ' ').trim());

  const { kept, rejected } = await generateQuestions({
    module: sub.module,
    subcategory: sub.id,
    count,
    difficulty: 'mixed',
    avoid,
  });

  if (kept.length) await prisma.taraQuestion.createMany({ data: kept });
  return { added: kept.length, rejected };
}

/**
 * Fill one subcategory to `want`, batch by batch.
 *
 * A short batch is retried rather than accepted, because the reasons a batch
 * comes back short — a mislabelled key, an unexplained distractor, a route that
 * needs algebra — are the reasons the validator exists, and quietly banking
 * three questions where five were asked for turns a quality gate into a
 * silent shortfall.
 */
async function fill(gap) {
  const { sub } = gap;
  let owed = gap.want;
  let misses = 0;

  while (owed > 0 && misses <= MAX_RETRIES) {
    const ask = Math.min(BATCH, owed);
    try {
      const { added, rejected } = await writeBatch(sub, ask);
      build.written += added;
      build.rejected += rejected.length;
      owed -= added;
      if (added === 0) {
        misses += 1;
        build.failures.push({
          key: keyOf(sub),
          name: sub.name,
          problem: rejected[0]?.problem || 'nothing usable came back',
        });
      } else {
        misses = 0;
      }
    } catch (e) {
      misses += 1;
      build.lastError = e.message;
      build.failures.push({ key: keyOf(sub), name: sub.name, problem: e.message });
      // A missing key or a hard upstream failure will not fix itself on the
      // next batch, so stop asking rather than burning the retry budget.
      if (/ANTHROPIC_API_KEY/.test(e.message)) throw e;
    }
  }
}

/* --------------------------------------------------------------------------
   The queue
   -------------------------------------------------------------------------- */

/** Run `gaps` through `fill`, CONCURRENCY at a time, keeping status current. */
async function drain(gaps) {
  const queue = [...gaps];
  build.pending = queue.map((g) => keyOf(g.sub));

  const worker = async () => {
    for (;;) {
      const gap = queue.shift();
      if (!gap) return;
      const key = keyOf(gap.sub);
      build.pending = build.pending.filter((k) => k !== key);
      build.active.push(key);
      try {
        await fill(gap);
      } catch (e) {
        build.lastError = e.message;
        // A fatal error empties the queue: without a key, every remaining
        // subcategory would fail the same way and fill the failure list with
        // 19 copies of the same sentence.
        queue.length = 0;
      } finally {
        build.active = build.active.filter((k) => k !== key);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}

/**
 * Start a build if one is owed and none is running.
 *
 * Safe to call from anywhere and as often as you like: it measures the bank,
 * and if the bank is stocked it does nothing at all.
 */
export async function ensureBank({ force = false } = {}) {
  if (build.running) return status();

  const counts = await stock();
  const seed = seedGaps(counts);
  const gaps = seed.length ? seed : topupGaps(counts);
  const kind = seed.length ? 'seed' : 'topup';

  if (!gaps.length && !force) return status();
  if (!process.env.ANTHROPIC_API_KEY) {
    build.lastError = 'ANTHROPIC_API_KEY is not set on the server, so the bank cannot write itself.';
    return status();
  }

  Object.assign(build, {
    running: true,
    kind,
    startedAt: new Date(),
    finishedAt: null,
    target: gaps.reduce((n, g) => n + g.want, 0),
    written: 0,
    rejected: 0,
    pending: gaps.map((g) => keyOf(g.sub)),
    active: [],
    failures: [],
    lastError: null,
  });

  // Deliberately not awaited. The caller is a request handler or a boot
  // sequence, and neither should hold open for the length of a build.
  drain(gaps)
    .catch((e) => {
      build.lastError = e.message;
    })
    .finally(() => {
      build.running = false;
      build.finishedAt = new Date();
      build.pending = [];
      build.active = [];
    });

  return status();
}

/**
 * A drill has just been served or answered, so the stock has moved. Check
 * whether anything fell under the floor, without making the caller wait.
 */
export function nudge() {
  if (build.running) return;
  ensureBank().catch(() => {
    // Reported through status(); a background top-up must never surface as a
    // failed drill request.
  });
}

/* --------------------------------------------------------------------------
   Status
   -------------------------------------------------------------------------- */

/**
 * What the progress strip renders from.
 *
 * `target` and `written` are what a build set out to do and what it has done,
 * so the bar cannot go backwards. `stocked` is measured separately, against the
 * whole taxonomy, so the strip can also say how much of the bank exists at all
 * — those are different questions and a single percentage would answer neither.
 */
export function status(counts) {
  const now = {
    running: build.running,
    kind: build.kind,
    target: build.target,
    written: build.written,
    rejected: build.rejected,
    /** The subcategory names currently being written, for the live line. */
    writing: build.active.map((k) => byKey[k]?.name).filter(Boolean),
    remaining: build.pending.length + build.active.length,
    failures: build.failures.slice(-6),
    lastError: build.lastError,
    startedAt: build.startedAt,
    finishedAt: build.finishedAt,
  };

  if (counts) {
    const cells = Object.values(counts);
    now.stocked = cells.reduce((n, c) => n + Math.min(c.total, SEED_TARGET), 0);
    now.stockTarget = LEAVES.length * SEED_TARGET;
    now.short = cells.filter((c) => c.total < SEED_TARGET).length;
    now.thin = cells.filter((c) => c.unseen < TOPUP_FLOOR).length;
  }

  return now;
}

/** Status with the stock counts attached. One extra pair of queries. */
export async function fullStatus() {
  return status(await stock());
}
