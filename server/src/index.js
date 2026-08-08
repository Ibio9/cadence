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
crud('tasks', prisma.task);
crud('inbox', prisma.inboxItem);
crud('rhythms', prisma.rhythm, { after: () => rebuildFuture(today()) });
crud('projects', prisma.project);

app.post('/api/jarvis', jarvis);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Cadence API on :${port}`));
