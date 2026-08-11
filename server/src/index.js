import express from 'express';
import cors from 'cors';
import { prisma } from './db.js';
import { materialise, rebuildFuture } from './materialise.js';
import { jarvis } from './routes/jarvis.js';

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

/* ---------- state ---------- */
app.get('/api/state', async (req, res) => {
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
  res.json({ date, projects, rhythms, blocks, history, inbox, tasks, chat });
});

/* ---------- generic CRUD ---------- */
const crud = (name, model, hooks = {}) => {
  app.post(`/api/${name}`, async (req, res) => {
    const row = await model.create({ data: req.body });
    await hooks.after?.(req);
    res.json(row);
  });
  app.patch(`/api/${name}/:id`, async (req, res) => {
    const row = await model.update({ where: { id: req.params.id }, data: req.body });
    await hooks.after?.(req);
    res.json(row);
  });
  app.delete(`/api/${name}/:id`, async (req, res) => {
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
app.get('/api/blocks/:id', async (req, res) => {
  const block = await prisma.block.findUnique({
    where: { id: req.params.id },
    include: { project: true },
  });
  if (!block) return res.status(404).json({ error: 'That block is not on any day. It may have been deleted.' });
  res.json(block);
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
  app.post(`/api/blocks/:id/${name}`, async (req, res) => {
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

app.post('/api/jarvis', jarvis);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Cadence API on :${port}`));
