/**
 * TARA Drill.
 *
 * The bank is the durable thing here. Questions are written once and kept;
 * attempts accumulate against them and are never overwritten. Everything the
 * app shows — the tree, the weakness set, the readiness view — is computed
 * from those two tables, so there is no separate progress state that can drift
 * out of step with what was actually answered.
 */

import { prisma } from '../db.js';
import { asyncRoutes } from '../routes.js';
import {
  SEED_TARGET,
  TOPUP_FLOOR,
  ensureBank,
  fullStatus,
  nudge,
} from '../tara/bank.js';
import { CONDITIONAL_FORMS, FLAWS, PS_MATHS_CEILING } from '../tara/catalogue.js';
import { generateQuestions } from '../tara/generate.js';
import {
  ALL_SUBCATEGORIES,
  MODULES,
  MODULE_QUESTIONS,
  budgetFor,
  getModule,
  isValidSubcategory,
} from '../tara/taxonomy.js';
import { CRITERIA, countWords, generatePrompts, markEssay } from '../tara/writing.js';

/** Answered right twice — retired from ordinary drilling, still in the bank. */
const MASTERY = 2;
const LABELS = ['A', 'B', 'C', 'D', 'E'];

/* --------------------------------------------------------------------------
   Stats
   -------------------------------------------------------------------------- */

/**
 * Everything the tree and the progress view need, from two reads. Small
 * enough to compute in memory, and doing it in one place means the accuracy
 * on a subcategory tile and the accuracy in the progress view can never
 * disagree.
 */
async function loadStats() {
  const [questions, attempts] = await Promise.all([
    prisma.taraQuestion.findMany({
      where: { retired: false },
      select: { id: true, module: true, subcategory: true, flaw: true, origin: true },
    }),
    prisma.taraAttempt.findMany({
      orderBy: { createdAt: 'asc' },
      select: { questionId: true, chosen: true, correct: true, seconds: true, mode: true, createdAt: true },
    }),
  ]);

  const qById = Object.fromEntries(questions.map((q) => [q.id, q]));

  // How many times each question has been answered correctly, which is what
  // "already know this" means when a set is being built.
  const correctCount = {};
  for (const a of attempts) if (a.correct) correctCount[a.questionId] = (correctCount[a.questionId] || 0) + 1;

  const blank = () => ({ asked: 0, right: 0, skipped: 0, seconds: 0, bank: 0, unseen: 0, mastered: 0 });
  const bySub = {};
  for (const s of ALL_SUBCATEGORIES) bySub[`${s.module}:${s.id}`] = blank();

  const seen = new Set(attempts.map((a) => a.questionId));
  for (const q of questions) {
    const cell = bySub[`${q.module}:${q.subcategory}`];
    if (!cell) continue;
    cell.bank += 1;
    if (!seen.has(q.id)) cell.unseen += 1;
    if ((correctCount[q.id] || 0) >= MASTERY) cell.mastered += 1;
  }

  for (const a of attempts) {
    const q = qById[a.questionId];
    if (!q) continue;
    const cell = bySub[`${q.module}:${q.subcategory}`];
    if (!cell) continue;
    cell.asked += 1;
    cell.seconds += a.seconds || 0;
    if (a.correct) cell.right += 1;
    if (!a.chosen) cell.skipped += 1;
  }

  return { questions, attempts, qById, correctCount, bySub };
}

/** Accuracy as a fraction, or null when nothing has been answered yet. An
 *  untried subcategory has no accuracy — it is not 0%. */
const accuracy = (cell) => (cell.asked ? cell.right / cell.asked : null);

function shapeTree(bySub) {
  return MODULES.map((m) => {
    const subs = m.subcategories.map((s) => {
      const cell = bySub[`${m.id}:${s.id}`] || { asked: 0, right: 0, seconds: 0, bank: 0, unseen: 0, mastered: 0 };
      return {
        id: s.id,
        name: s.name,
        attack: s.attack,
        group: s.group || null,
        groupName: s.groupName || null,
        asked: cell.asked,
        right: cell.right,
        accuracy: accuracy(cell),
        avgSeconds: cell.asked ? Math.round(cell.seconds / cell.asked) : null,
        bank: cell.bank,
        unseen: cell.unseen,
        mastered: cell.mastered,
      };
    });
    const asked = subs.reduce((n, s) => n + s.asked, 0);
    const right = subs.reduce((n, s) => n + s.right, 0);
    return {
      id: m.id,
      name: m.name,
      blurb: m.blurb,
      kind: m.kind,
      flat: m.flat,
      groups: m.groups?.map((g) => ({ id: g.id, name: g.name, blurb: g.blurb })) || null,
      questions: m.questions ?? null,
      minutes: m.minutes,
      secondsPerQuestion: m.secondsPerQuestion ?? null,
      wordLimit: m.wordLimit ?? null,
      promptCount: m.promptCount ?? null,
      asked,
      right,
      accuracy: asked ? right / asked : null,
      bank: subs.reduce((n, s) => n + s.bank, 0),
      subcategories: subs,
    };
  });
}

/* --------------------------------------------------------------------------
   Selection
   -------------------------------------------------------------------------- */

/**
 * Build a set.
 *
 * The rule that shapes all of this: a question answered correctly twice is not
 * shown again unless a review set is asked for. Beyond that, unseen questions
 * come first and the least recently attempted come next, so drilling works
 * through the bank rather than circling its first few items.
 */
function pick({ pool, correctCount, lastSeen, count, mode }) {
  const review = mode === 'review';
  const eligible = pool.filter((q) => {
    const done = correctCount[q.id] || 0;
    return review ? lastSeen[q.id] != null : done < MASTERY;
  });

  const scored = eligible.map((q) => ({
    q,
    unseen: lastSeen[q.id] == null ? 0 : 1,
    last: lastSeen[q.id] ?? 0,
    jitter: Math.random(),
  }));

  // Unseen first, then oldest-attempted, with a little noise so a repeated
  // set of the same length is not the same set in the same order.
  scored.sort((a, b) => a.unseen - b.unseen || a.last - b.last || a.jitter - b.jitter);
  return scored.slice(0, count).map((s) => s.q);
}

const shapeQuestion = (q) => ({
  id: q.id,
  module: q.module,
  subcategory: q.subcategory,
  passage: q.passage,
  stem: q.stem,
  options: q.options,
  answer: q.answer,
  route: q.route,
  why: q.why,
  distractors: q.distractors,
  difficulty: q.difficulty,
  origin: q.origin,
  source: q.source,
  flaw: q.flaw,
});

/* --------------------------------------------------------------------------
   Routes
   -------------------------------------------------------------------------- */

export function mountTara(app) {
  // Every handler below is async; see src/routes.js.
  const r = asyncRoutes(app);

  /* ---- the tree, with accuracy on every node ---- */
  r.get('/api/tara/state', async (_req, res) => {
    const { bySub, attempts, qById } = await loadStats();
    const [prompts, essays] = await Promise.all([
      prisma.taraPrompt.findMany({ orderBy: { createdAt: 'desc' }, take: 12, include: { essays: true } }),
      prisma.taraEssay.count({ where: { submitted: true } }),
    ]);

    // Opening the section is the natural moment to notice the bank is thin.
    // It runs behind the response, so this costs the request nothing.
    nudge();

    res.json({
      modules: shapeTree(bySub),
      writing: {
        prompts: prompts.map((p) => ({
          id: p.id,
          statement: p.statement,
          q1: p.q1,
          q2: p.q2,
          q3: p.q3,
          origin: p.origin,
          createdAt: p.createdAt,
          essays: p.essays.filter((e) => e.submitted).length,
        })),
        marked: essays,
      },
      readiness: readiness(attempts, qById),
      bank: { seedTarget: SEED_TARGET, topupFloor: TOPUP_FLOOR },
    });
  });

  /* ---- how the bank is coming along ----
     Polled by the progress strip while a build runs. Two cheap queries, no
     model calls: asking how it is going must never itself be expensive. */
  r.get('/api/tara/bank', async (_req, res) => {
    res.json(await fullStatus());
  });

  /** Start a build by hand. Idempotent — if one is running, this returns it. */
  r.post('/api/tara/bank', async (req, res) => {
    res.json(await ensureBank({ force: Boolean(req.body?.force) }));
  });

  /* ---- the reference material ----
     Served rather than copied into the web app so the catalogue you revise
     from and the catalogue questions are built from cannot drift apart. */
  r.get('/api/tara/reference', async (_req, res) => {
    res.json({
      flaws: FLAWS,
      conditionalForms: CONDITIONAL_FORMS,
      mathsCeiling: PS_MATHS_CEILING,
      modules: MODULES.map((m) => ({
        id: m.id,
        name: m.name,
        kind: m.kind,
        minutes: m.minutes,
        questions: m.questions ?? null,
        secondsPerQuestion: m.secondsPerQuestion ?? null,
        wordLimit: m.wordLimit ?? null,
        groups: m.groups?.map((g) => ({ id: g.id, name: g.name, blurb: g.blurb })) || null,
        subcategories: m.subcategories.map((s) => ({
          id: s.id,
          name: s.name,
          attack: s.attack,
          group: s.group || null,
        })),
      })),
      criteria: CRITERIA,
    });
  });

  /* ---- build a set ---- */
  r.get('/api/tara/drill', async (req, res) => {
    const mode = String(req.query.mode || 'practice');
    const module = String(req.query.module || '');
    const subcategory = req.query.subcategory ? String(req.query.subcategory) : null;
    const origin = String(req.query.origin || 'any'); // any | generated | real
    let count = Math.max(1, Math.min(50, Number(req.query.count) || 10));

    if (!getModule(module)) return res.status(400).json({ error: `"${module}" is not a module.` });
    if (subcategory && !isValidSubcategory(module, subcategory)) {
      return res.status(400).json({ error: `"${subcategory}" is not a subcategory of ${module}.` });
    }
    if (mode === 'mock') count = MODULE_QUESTIONS;

    const { correctCount, attempts } = await loadStats();
    const lastSeen = {};
    for (const a of attempts) lastSeen[a.questionId] = new Date(a.createdAt).getTime();

    const where = { retired: false, module };
    if (subcategory) where.subcategory = subcategory;
    if (origin !== 'any') where.origin = origin;

    let pool = await prisma.taraQuestion.findMany({ where });

    // A weakness set ignores the requested subcategory and goes where the
    // accuracy is worst — that is the whole point of it.
    if (mode === 'weakness') {
      const { bySub } = await loadStats();
      const ranked = getModule(module)
        .subcategories.map((s) => ({ id: s.id, acc: accuracy(bySub[`${module}:${s.id}`] || {}) }))
        .filter((s) => s.acc != null)
        .sort((a, b) => a.acc - b.acc)
        .slice(0, 3)
        .map((s) => s.id);
      if (ranked.length) pool = pool.filter((q) => ranked.includes(q.subcategory));
    }

    const chosen = pick({ pool, correctCount, lastSeen, count, mode });

    res.json({
      mode,
      module,
      subcategory,
      requested: count,
      // Said plainly rather than silently returning a short set: a 6-question
      // "10-question" drill would otherwise look like a bug.
      shortfall: Math.max(0, count - chosen.length),
      secondsPerQuestion: budgetFor(module),
      questions: chosen.map(shapeQuestion),
    });
  });

  /* ---- record answers ---- */
  r.post('/api/tara/attempts', async (req, res) => {
    const rows = Array.isArray(req.body?.attempts) ? req.body.attempts : [];
    if (!rows.length) return res.status(400).json({ error: 'No attempts were sent.' });

    const ids = rows.map((r) => String(r.questionId));
    const known = await prisma.taraQuestion.findMany({ where: { id: { in: ids } }, select: { id: true, answer: true } });
    const answerById = Object.fromEntries(known.map((q) => [q.id, q.answer]));

    const data = [];
    for (const r of rows) {
      const key = answerById[r.questionId];
      if (!key) continue; // the question was deleted mid-set; drop it quietly
      const chosen = LABELS.includes(r.chosen) ? r.chosen : null;
      data.push({
        questionId: String(r.questionId),
        chosen,
        // Graded here, not on the client, so the record cannot disagree with
        // the bank even if the client is stale.
        correct: chosen != null && chosen === key,
        seconds: Math.max(0, Math.min(3600, Math.round(Number(r.seconds) || 0))),
        mode: String(r.mode || 'practice'),
      });
    }
    if (!data.length) return res.status(400).json({ error: 'None of those questions are in the bank.' });

    await prisma.taraAttempt.createMany({ data });

    // Answering is what turns unseen stock into seen stock, so this is the one
    // moment the usable bank definitely shrank. Check the floor behind the
    // response rather than making the person wait to find out their score.
    nudge();

    res.json({ recorded: data.length, correct: data.filter((d) => d.correct).length });
  });

  /* ---- generate into the bank ---- */
  r.post('/api/tara/generate', async (req, res) => {
    const { module, subcategory, difficulty = 'mixed' } = req.body || {};
    const count = Math.max(1, Math.min(10, Number(req.body?.count) || 5));

    if (!isValidSubcategory(module, subcategory)) {
      return res.status(400).json({ error: `"${module}/${subcategory}" is not a subcategory.` });
    }

    try {
      // Show it what is already there so it writes something new rather than a
      // variation on the last batch.
      const recent = await prisma.taraQuestion.findMany({
        where: { module, subcategory },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { stem: true, passage: true },
      });
      const avoid = recent.map((r) => `${r.passage.slice(0, 90)} … ${r.stem}`.replace(/\s+/g, ' ').trim());

      const { kept, rejected } = await generateQuestions({ module, subcategory, count, difficulty, avoid });
      if (kept.length) await prisma.taraQuestion.createMany({ data: kept });

      res.json({ added: kept.length, rejected });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  /* ---- browse and edit the bank ---- */
  r.get('/api/tara/questions', async (req, res) => {
    const where = { retired: req.query.retired === 'true' };
    if (req.query.module) where.module = String(req.query.module);
    if (req.query.subcategory) where.subcategory = String(req.query.subcategory);
    if (req.query.origin && req.query.origin !== 'any') where.origin = String(req.query.origin);

    const take = Math.max(1, Math.min(100, Number(req.query.take) || 40));
    const skip = Math.max(0, Number(req.query.skip) || 0);

    const [total, rows] = await Promise.all([
      prisma.taraQuestion.count({ where }),
      prisma.taraQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { attempts: { select: { correct: true } } },
      }),
    ]);

    res.json({
      total,
      questions: rows.map((q) => ({
        ...shapeQuestion(q),
        retired: q.retired,
        createdAt: q.createdAt,
        asked: q.attempts.length,
        right: q.attempts.filter((a) => a.correct).length,
      })),
    });
  });

  /** Enter a real past-paper question by hand. Validated the same way a
   *  generated one is — a typo here is as damaging as a bad generation. */
  r.post('/api/tara/questions', async (req, res) => {
    const b = req.body || {};
    if (!isValidSubcategory(b.module, b.subcategory)) {
      return res.status(400).json({ error: `"${b.module}/${b.subcategory}" is not a subcategory.` });
    }
    const options = Array.isArray(b.options) ? b.options : [];
    if (options.length !== 5 || options.some((o) => !o?.text?.trim())) {
      return res.status(400).json({ error: 'A question needs exactly five options, all with text.' });
    }
    if (!LABELS.includes(b.answer)) return res.status(400).json({ error: 'The answer must be A, B, C, D or E.' });
    if (!b.stem?.trim()) return res.status(400).json({ error: 'A question needs a stem.' });

    const row = await prisma.taraQuestion.create({
      data: {
        module: b.module,
        subcategory: b.subcategory,
        passage: String(b.passage || '').trim(),
        stem: b.stem.trim(),
        options: LABELS.map((label, i) => ({ label, text: String(options[i].text).trim() })),
        answer: b.answer,
        route: String(b.route || '').trim(),
        why: String(b.why || '').trim(),
        distractors: Array.isArray(b.distractors) ? b.distractors : [],
        difficulty: b.difficulty || 'medium',
        origin: 'real',
        source: b.source ? String(b.source).trim() : null,
        flaw: b.flaw || null,
      },
    });
    res.json(shapeQuestion(row));
  });

  r.patch('/api/tara/questions/:id', async (req, res) => {
    const data = {};
    for (const k of ['passage', 'stem', 'why', 'route', 'source', 'difficulty', 'answer', 'flaw']) {
      if (req.body?.[k] !== undefined) data[k] = req.body[k];
    }
    if (req.body?.retired !== undefined) data.retired = Boolean(req.body.retired);
    if (req.body?.options !== undefined) data.options = req.body.options;
    if (req.body?.distractors !== undefined) data.distractors = req.body.distractors;

    const row = await prisma.taraQuestion.update({ where: { id: req.params.id }, data });
    res.json(shapeQuestion(row));
  });

  r.delete('/api/tara/questions/:id', async (req, res) => {
    await prisma.taraQuestion.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });

  /* ---- progress ---- */
  r.get('/api/tara/progress', async (_req, res) => {
    const { attempts, qById, bySub } = await loadStats();

    // Accuracy over time, in blocks of twenty answers, so a trend is visible
    // without pretending a single answer moves anything.
    const trend = {};
    for (const m of MODULES.filter((x) => x.kind === 'mcq')) trend[m.id] = [];
    const running = {};
    for (const a of attempts) {
      const q = qById[a.questionId];
      if (!q) continue;
      running[q.module] ??= [];
      running[q.module].push(a.correct ? 1 : 0);
      const bucket = running[q.module];
      if (bucket.length % 20 === 0) {
        const slice = bucket.slice(-20);
        trend[q.module].push({
          upTo: bucket.length,
          accuracy: slice.reduce((n, v) => n + v, 0) / slice.length,
        });
      }
    }

    // Which flaws keep being missed, by name.
    const flawMiss = {};
    for (const a of attempts) {
      const q = qById[a.questionId];
      if (!q?.flaw) continue;
      flawMiss[q.flaw] ??= { asked: 0, missed: 0 };
      flawMiss[q.flaw].asked += 1;
      if (!a.correct) flawMiss[q.flaw].missed += 1;
    }
    const flaws = FLAWS.filter((f) => flawMiss[f.id]?.asked)
      .map((f) => ({
        id: f.id,
        name: f.name,
        shape: f.shape,
        asked: flawMiss[f.id].asked,
        missed: flawMiss[f.id].missed,
        accuracy: (flawMiss[f.id].asked - flawMiss[f.id].missed) / flawMiss[f.id].asked,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    // Where the minutes go, against the budget.
    const timing = MODULES.filter((m) => m.kind === 'mcq').map((m) => {
      const subs = m.subcategories.map((s) => {
        const cell = bySub[`${m.id}:${s.id}`];
        return {
          id: s.id,
          name: s.name,
          avgSeconds: cell.asked ? Math.round(cell.seconds / cell.asked) : null,
          asked: cell.asked,
        };
      });
      return { module: m.id, name: m.name, budget: m.secondsPerQuestion, subcategories: subs };
    });

    const mocks = await recentMocks(attempts, qById);

    res.json({ modules: shapeTree(bySub), trend, flaws, timing, mocks, readiness: readiness(attempts, qById) });
  });

  /* ---- writing task ---- */
  r.post('/api/tara/writing/prompts', async (_req, res) => {
    try {
      const previous = await prisma.taraPrompt.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: { statement: true },
      });
      const prompts = await generatePrompts({ avoid: previous.map((p) => p.statement) });
      if (!prompts.length) return res.status(502).json({ error: 'No usable prompts came back. Try again.' });
      const created = await prisma.$transaction(prompts.map((data) => prisma.taraPrompt.create({ data })));
      res.json({ prompts: created });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  /** Start an attempt at a prompt, or save a draft as the clock runs. */
  r.post('/api/tara/writing/essays', async (req, res) => {
    const { promptId, id, text = '', seconds = 0 } = req.body || {};
    const words = countWords(text);

    if (id) {
      const row = await prisma.taraEssay.update({
        where: { id },
        data: { text, words, seconds: Math.max(0, Math.round(Number(seconds) || 0)) },
      });
      return res.json(row);
    }
    if (!promptId) return res.status(400).json({ error: 'Which prompt is this for?' });
    const row = await prisma.taraEssay.create({ data: { promptId, text, words } });
    res.json(row);
  });

  r.post('/api/tara/writing/essays/:id/mark', async (req, res) => {
    const essay = await prisma.taraEssay.findUnique({ where: { id: req.params.id }, include: { prompt: true } });
    if (!essay) return res.status(404).json({ error: 'That essay is not here. It may have been deleted.' });

    const text = String(req.body?.text ?? essay.text ?? '');
    const seconds = Math.max(0, Math.round(Number(req.body?.seconds ?? essay.seconds) || 0));
    if (countWords(text) < 50) {
      return res.status(400).json({ error: 'There is not enough here to mark. Write the essay first.' });
    }

    try {
      const { mark, exemplar, divergences } = await markEssay({ prompt: essay.prompt, text, seconds });
      const row = await prisma.taraEssay.update({
        where: { id: essay.id },
        data: { text, words: countWords(text), seconds, submitted: true, mark, exemplar, divergences },
      });
      res.json({ ...row, prompt: essay.prompt });
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  r.get('/api/tara/writing/essays/:id', async (req, res) => {
    const row = await prisma.taraEssay.findUnique({ where: { id: req.params.id }, include: { prompt: true } });
    if (!row) return res.status(404).json({ error: 'That essay is not here. It may have been deleted.' });
    res.json(row);
  });

  r.get('/api/tara/writing/essays', async (_req, res) => {
    const rows = await prisma.taraEssay.findMany({
      where: { submitted: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { prompt: true },
    });
    res.json({ essays: rows, criteria: CRITERIA });
  });
}

/* --------------------------------------------------------------------------
   Readiness
   -------------------------------------------------------------------------- */

/** Recent full mocks, scored out of 22 and timed. */
async function recentMocks(attempts, qById) {
  const byModule = {};
  for (const a of attempts) {
    if (a.mode !== 'mock') continue;
    const q = qById[a.questionId];
    if (!q) continue;
    byModule[q.module] ??= [];
    byModule[q.module].push(a);
  }

  const out = [];
  for (const [module, rows] of Object.entries(byModule)) {
    // A mock is a burst: anything within four hours of the previous answer is
    // the same sitting.
    let run = [];
    const sittings = [];
    let prev = null;
    for (const a of rows) {
      const t = new Date(a.createdAt).getTime();
      if (prev != null && t - prev > 4 * 3600e3) {
        sittings.push(run);
        run = [];
      }
      run.push(a);
      prev = t;
    }
    if (run.length) sittings.push(run);

    for (const s of sittings.slice(-8)) {
      out.push({
        module,
        at: s[0].createdAt,
        answered: s.length,
        score: s.filter((a) => a.correct).length,
        outOf: MODULE_QUESTIONS,
        seconds: s.reduce((n, a) => n + (a.seconds || 0), 0),
        skipped: s.filter((a) => !a.chosen).length,
      });
    }
  }
  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
}

/**
 * The honest view. The target is 20–22 out of 22, consistently, inside the
 * time — so this reports the recent projection and whether the pace holds,
 * and does not average a weak module away against a strong one.
 */
function readiness(attempts, qById) {
  const out = {};
  for (const m of MODULES.filter((x) => x.kind === 'mcq')) {
    const rows = attempts.filter((a) => qById[a.questionId]?.module === m.id);
    const recent = rows.slice(-60);
    if (!recent.length) {
      out[m.id] = { module: m.id, name: m.name, answered: 0, accuracy: null, projected: null, pace: null, target: 20 };
      continue;
    }
    const acc = recent.filter((a) => a.correct).length / recent.length;
    const times = recent.map((a) => a.seconds || 0).filter((s) => s > 0).sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : null;
    out[m.id] = {
      module: m.id,
      name: m.name,
      answered: rows.length,
      accuracy: acc,
      projected: Math.round(acc * MODULE_QUESTIONS),
      pace: median,
      budget: m.secondsPerQuestion,
      onPace: median != null ? median <= m.secondsPerQuestion : null,
      target: 20,
    };
  }
  return out;
}
