import express from 'express';
import cors from 'cors';
import { prisma } from './db.js';
import { materialise, rebuildFuture } from './materialise.js';
import { FADED_BELOW, forTopic, loadRetention } from './retention.js';
import { jarvis } from './routes/jarvis.js';
import { mountInterview } from './routes/interview.js';
import { mountTara } from './routes/tara.js';
import { asyncRoutes } from './routes.js';
import { ensureTopics } from './interview/topics.js';
import { ensureBank } from './tara/bank.js';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));

const TOKEN = process.env.CADENCE_TOKEN;
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (!TOKEN) return res.status(500).json({ error: 'CADENCE_TOKEN is not set on the server.' });
  if (req.get('x-cadence-token') !== TOKEN) return res.status(401).json({ error: 'Bad token.' });
  next();
});

app.get('/health', (_, res) => res.json({ ok: true }));

/** Async-safe route registration. See src/routes.js for why it is needed. */
const r = asyncRoutes(app);

/* ---------- state ---------- */
r.get('/api/state', async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  await materialise(date);
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [projects, rhythms, blocks, history, inbox, tasks, chat] = await Promise.all([
    prisma.project.findMany({ orderBy: { order: 'asc' } }),
    prisma.rhythm.findMany({ orderBy: { startMin: 'asc' } }),
    prisma.block.findMany({ where: { date }, orderBy: { startMin: 'asc' } }),
    prisma.block.findMany({ where: { date: { gte: since } }, select: { date: true, status: true } }),
    prisma.inboxItem.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.task.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' }, take: 60 }),
  ]);
  // The spine marks a block whose topic has badly decayed. Computed here
  // rather than fetched separately, so the marker arrives with the row and
  // the day never renders once without it and once with.
  const { topics } = await loadRetention();
  const retention = {};
  for (const b of blocks) {
    const t = forTopic(topics, { title: b.title, projectId: b.projectId });
    if (t) retention[b.id] = { strength: t.strength, daysSince: t.daysSince, sessions: t.sessions, faded: t.strength < FADED_BELOW };
  }

  res.json({ date, projects, rhythms, blocks, history, inbox, tasks, chat, retention });
});

/* ---------- generic CRUD ---------- */
const crud = (name, model, hooks = {}) => {
  r.post(`/api/${name}`, async (req, res) => {
    const row = await model.create({ data: req.body });
    await hooks.after?.(req);
    res.json(row);
  });
  r.patch(`/api/${name}/:id`, async (req, res) => {
    const row = await model.update({ where: { id: req.params.id }, data: req.body });
    await hooks.after?.(req);
    res.json(row);
  });
  r.delete(`/api/${name}/:id`, async (req, res) => {
    await model.delete({ where: { id: req.params.id } });
    await hooks.after?.(req);
    res.json({ ok: true });
  });
};

const today = () => new Date().toISOString().slice(0, 10);
crud('blocks', prisma.block);

/* ---------- one block, by id ----------
   Focus is a real, linkable route: it is opened by id, without a date, so it
   has to be able to load a single block on its own. */
r.get('/api/blocks/:id', async (req, res) => {
  const block = await prisma.block.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!block) return res.status(404).json({ error: 'That block is not on any day. It may have been deleted.' });

  // The small version of the curve, for the one topic this hour is about.
  const { topics } = await loadRetention();
  res.json({ ...block, retention: forTopic(topics, { title: block.title, projectId: block.projectId }) });
});

/* ---------- the session clock ----------
   The clock lives on the server so a refresh, a second tab or a closed laptop
   cannot lose or invent time. `startedAt` is the running-since stamp and
   `elapsedSec` is what has already been banked; the client only ever renders
   elapsedSec + (now - startedAt) and never writes either field itself. */
const bank = (block) =>
  block.startedAt
    ? block.elapsedSec + Math.max(0, Math.round((Date.now() - block.startedAt.getTime()) / 1000))
    : block.elapsedSec;

const session = (name, next) => {
  r.post(`/api/blocks/:id/${name}`, async (req, res) => {
    const block = await prisma.block.findUnique({ where: { id: req.params.id } });
    if (!block) return res.status(404).json({ error: 'That block is not on any day. It may have been deleted.' });
    const row = await prisma.block.update({
      where: { id: block.id },
      data: next(block),
      include: { project: true },
    });
    res.json(row);
  });
};

// Starting an already-running clock is a no-op rather than an error: two tabs
// pressing start must not double-count or reset the stamp.
session('start', (b) => (b.startedAt ? {} : { startedAt: new Date(), status: 'pending' }));
session('pause', (b) => ({ elapsedSec: bank(b), startedAt: null }));
session('done', (b) => ({ elapsedSec: bank(b), startedAt: null, status: 'done' }));
session('reopen', () => ({ status: 'pending' }));
crud('tasks', prisma.task);
crud('inbox', prisma.inboxItem);
crud('rhythms', prisma.rhythm, { after: () => rebuildFuture(today()) });
crud('projects', prisma.project);

r.post('/api/jarvis', jarvis);

/* ---------- retention ----------
   One computation, read by the retention screen. Everything else that needs
   it gets it folded into the response it was already making. */
r.get('/api/retention', async (_req, res) => {
  res.json(await loadRetention());
});

mountTara(app);
mountInterview(app);

// The end of the line for anything the wrappers in routes.js caught. Must stay
// last: Express picks error middleware by arity and by position.
app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  if (res.headersSent) return;
  const known = err?.code === 'P2025';
  res.status(known ? 404 : 500).json({
    error: known ? 'That record is no longer here.' : 'The server could not complete that. Try again.',
  });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Cadence API on :${port}`);

  // Stock the question bank. On the first boot this writes a few hundred
  // questions over the following half hour; on every boot after that it
  // measures the bank, finds it full, and does nothing.
  //
  // Delayed so a cold start serves its first request before the model calls
  // start competing for the process, and swallowed because a bank that cannot
  // build itself is a thing the TARA screens report — not a reason to take the
  // whole API down.
  setTimeout(() => {
    ensureBank().catch((e) => console.error('[bank]', e.message));
    ensureTopics().catch((e) => console.error('[interview]', e.message));
  }, 5000).unref();
});
