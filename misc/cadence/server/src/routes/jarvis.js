import { prisma } from './../db.js';
import { decayed, loadRetention } from './../retention.js';

const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const parseT = (s) => { const [h, m] = String(s).split(':'); return (+h) * 60 + (+(m || 0)); };

const SYSTEM = `You are Jarvis, the resident intelligence inside Cadence — Ibrahim's personal operating system. He is a solo founder (StudentSolve, an AI revision platform for UK GCSE/A-level students), studying Further Maths, Maths, Economics and Philosophy, targeting Oxford PPE, and training regularly. He built you to help him hold a plan.

Voice: direct and factual first, briefly encouraging second, always anchored to his real numbers. Never flatter. Never moralise. If he missed blocks, name what he missed and what it cost, then give one concrete next move. One or two short paragraphs. No bullet lists unless he asks for them.

You can act on his system by ending your reply with a fenced json block:
\`\`\`json
{"blocks":[{"title":"...","start":"14:00","end":"15:30","projectId":"ss"}],
 "tasks":[{"title":"...","projectId":"ss","energy":"deep","est":45}],
 "clearInbox":["exact inbox text you converted"]}
\`\`\`
Rules: only schedule inside the listed openGaps; never overlap a fixed block; never schedule a time that has already passed; use real project ids from the state. Omit keys you aren't using, and omit the json block entirely if you're only talking.

DECAY DRIVES WHAT YOU PROPOSE. The state carries "decayedTopics": things he has built up and then left, worst first, with how long since and how many sessions built it. When he asks what to do with an hour, or when you are filling a gap or naming an objective for a block, take from that list first and say which one and how long it has been. A topic with several sessions behind it that has slipped is worth more than a fresh one — the work is already there and is about to be wasted.

The strength numbers are a model, not a measurement of his memory. Use them to order what you suggest. Never quote one back at him as a fact.`;

async function buildContext(date) {
  const [projects, blocks, inbox, tasks] = await Promise.all([
    prisma.project.findMany(),
    prisma.block.findMany({ where: { date }, orderBy: { startMin: 'asc' }, include: { project: true } }),
    prisma.inboxItem.findMany(),
    prisma.task.findMany({ where: { done: false }, include: { project: true } }),
  ]);
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const recent = await prisma.block.findMany({ where: { date: { gte: since } }, select: { date: true, status: true } });

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const gaps = [];
  let cur = Math.max(nowMin, 6 * 60);
  for (const b of blocks) { if (b.startMin - cur >= 25) gaps.push([cur, b.startMin]); cur = Math.max(cur, b.endMin); }
  if (23 * 60 - cur >= 25) gaps.push([cur, 23 * 60]);

  // What has slipped. Read straight into the context so every reply is
  // grounded in it rather than needing to be asked for.
  const { topics } = await loadRetention();

  const byDay = {};
  for (const b of recent) {
    byDay[b.date] ??= { held: 0, settled: 0, planned: 0 };
    byDay[b.date].planned++;
    if (b.status !== 'pending') byDay[b.date].settled++;
    if (b.status === 'done') byDay[b.date].held++;
  }

  return {
    now: now.toLocaleString('en-GB'),
    viewing: date,
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    todayBlocks: blocks.map((b) => ({
      title: b.title, from: hhmm(b.startMin), to: hhmm(b.endMin),
      project: b.project.name, fixed: b.fixed, status: b.status, author: b.source,
    })),
    openGaps: gaps.map(([a, b]) => `${hhmm(a)}–${hhmm(b)} (${b - a} min)`),
    inbox: inbox.map((i) => i.text),
    openTasks: tasks.map((t) => ({ title: t.title, project: t.project.name, energy: t.energy, mins: t.est })),
    last7Days: byDay,
    decayedTopics: decayed(topics, { limit: 8 }).map((t) => ({
      topic: t.label,
      lastWorkedDaysAgo: t.daysSince,
      sessionsBehindIt: t.sessions,
      halfLifeDays: t.half,
    })),
  };
}

export async function jarvis(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set on the server.' });

  const { message, date } = req.body;
  const day = date || new Date().toISOString().slice(0, 10);

  try {
    await prisma.chatMessage.create({ data: { role: 'user', text: message } });
    const history = await prisma.chatMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 13 });
    const prior = history.reverse().slice(0, -1).map((m) => ({ role: m.role, content: m.text }));
    const context = await buildContext(day);

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: SYSTEM,
        messages: [...prior, { role: 'user', content: `SYSTEM STATE:\n${JSON.stringify(context, null, 1)}\n\nIBRAHIM: ${message}` }],
      }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);

    let text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    const match = text.match(/```json([\s\S]*?)```/);
    let applied = 0;
    if (match) {
      text = text.replace(match[0], '').trim();
      applied = await applyActions(JSON.parse(match[1]), day, context.projects);
    }
    await prisma.chatMessage.create({ data: { role: 'assistant', text } });
    res.json({ text, applied });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}

async function applyActions(a, date, projects) {
  const valid = new Set(projects.map((p) => p.id));
  const fallback = projects[0]?.id;
  let n = 0;

  for (const b of a.blocks || []) {
    const start = parseT(b.start), end = parseT(b.end);
    if (!(end > start)) continue;
    await prisma.block.create({
      data: {
        date, title: b.title, startMin: start, endMin: end,
        projectId: valid.has(b.projectId) ? b.projectId : fallback,
        source: 'jarvis', fixed: false,
      },
    });
    n++;
  }
  for (const t of a.tasks || []) {
    await prisma.task.create({
      data: {
        title: t.title, energy: t.energy || 'any', est: t.est || 30,
        projectId: valid.has(t.projectId) ? t.projectId : fallback,
      },
    });
    n++;
  }
  for (const text of a.clearInbox || []) {
    await prisma.inboxItem.deleteMany({ where: { text: String(text).trim() } });
  }
  return n;
}
