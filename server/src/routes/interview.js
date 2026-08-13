/**
 * The PPE interview drill.
 *
 * A session is a small state machine, and the stage lives on the server so a
 * refresh, a closed laptop or a second tab all land in the same place. The
 * client never decides what happens next; it reads `stage` and renders it.
 *
 *   prep      15 minutes with the prompt and the notes pane
 *   answering recording the first answer
 *   marking   a critique is in flight
 *   round1    critique, model answer, and the tutor's push-back
 *   followup  recording the answer to the push-back
 *   done      both rounds marked, one verdict
 */

import { prisma } from '../db.js';
import { asyncRoutes } from '../routes.js';
import { critique } from '../interview/critique.js';
import {
  ANSWER_MAX_SECONDS,
  ANSWER_MIN_SECONDS,
  DIMENSIONS,
  DIMENSION_IDS,
  PREP_SECONDS,
  STRANDS,
} from '../interview/strands.js';
import { ensureTopics, isWritingTopics, pickTopic } from '../interview/topics.js';

/** Below this, there is not enough said to mark. */
const MIN_WORDS = 40;

const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;

/* --------------------------------------------------------------------------
   Trends
   -------------------------------------------------------------------------- */

/**
 * Score per dimension over time, and which one is worst.
 *
 * Round two is weighted double. It is the unprepared answer, and how someone
 * handles push-back on their own claim is most of what an interview measures —
 * averaging it flat against a rehearsed opening would hide exactly the thing
 * worth knowing.
 */
function trend(sessions) {
  const points = [];
  const totals = Object.fromEntries(DIMENSION_IDS.map((d) => [d, { sum: 0, weight: 0 }]));

  for (const s of sessions) {
    const rounds = [...s.rounds].sort((a, b) => a.n - b.n).filter((r) => r.scores);
    if (!rounds.length) continue;

    const at = {};
    for (const id of DIMENSION_IDS) {
      let sum = 0;
      let weight = 0;
      for (const r of rounds) {
        const v = Number(r.scores?.[id]);
        if (!Number.isFinite(v)) continue;
        const w = r.n === 2 ? 2 : 1;
        sum += v * w;
        weight += w;
      }
      if (!weight) continue;
      at[id] = sum / weight;
      totals[id].sum += sum;
      totals[id].weight += weight;
    }

    if (Object.keys(at).length) {
      points.push({ id: s.id, at: s.createdAt, strand: s.strand, prompt: s.prompt, scores: at });
    }
  }

  points.reverse(); // oldest first, so a chart reads left to right

  const averages = {};
  for (const id of DIMENSION_IDS) {
    averages[id] = totals[id].weight ? totals[id].sum / totals[id].weight : null;
  }

  // The most recent five carry the weakness call: what you were bad at in
  // March should not still be choosing your topics in August.
  const recent = points.slice(-5);
  const recentAvg = {};
  for (const id of DIMENSION_IDS) {
    const vals = recent.map((p) => p.scores[id]).filter((v) => Number.isFinite(v));
    recentAvg[id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  const ranked = DIMENSION_IDS.filter((id) => recentAvg[id] != null).sort((a, b) => recentAvg[a] - recentAvg[b]);

  return { points, averages, recent: recentAvg, weakest: ranked[0] || null, sat: points.length };
}

const shapeRound = (r) => ({
  id: r.id,
  n: r.n,
  question: r.question,
  transcript: r.transcript,
  seconds: r.seconds,
  scores: r.scores,
  critique: r.critique,
  modelAnswer: r.modelAnswer,
  sources: r.sources,
  createdAt: r.createdAt,
});

const shapeSession = (s) => ({
  id: s.id,
  strand: s.strand,
  prompt: s.prompt,
  context: s.context,
  notes: s.notes,
  prepSec: s.prepSec,
  stage: s.stage,
  weakness: s.weakness,
  nextTime: s.nextTime,
  createdAt: s.createdAt,
  rounds: [...(s.rounds || [])].sort((a, b) => a.n - b.n).map(shapeRound),
});

/* --------------------------------------------------------------------------
   Routes
   -------------------------------------------------------------------------- */

export function mountInterview(app) {
  const r = asyncRoutes(app);

  /* ---- the front door: history, trend, and what is in the pool ---- */
  r.get('/api/interview/state', async (_req, res) => {
    const [sessions, unseen] = await Promise.all([
      prisma.interviewSession.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { rounds: true },
      }),
      prisma.interviewTopic.count({ where: { usedAt: null } }),
    ]);

    // Opening the section is when to notice the pool is thin.
    ensureTopics().catch(() => {});

    const t = trend(sessions);
    res.json({
      dimensions: DIMENSIONS,
      strands: STRANDS,
      prepSeconds: PREP_SECONDS,
      answerWindow: { min: ANSWER_MIN_SECONDS, max: ANSWER_MAX_SECONDS },
      pool: { unseen, writing: isWritingTopics(), ready: unseen > 0 },
      trend: t,
      sessions: sessions.map((s) => ({
        id: s.id,
        strand: s.strand,
        prompt: s.prompt,
        stage: s.stage,
        weakness: s.weakness,
        createdAt: s.createdAt,
        scores: [...s.rounds].sort((a, b) => a.n - b.n).map((x) => ({ n: x.n, scores: x.scores })),
      })),
    });
  });

  /* ---- start ----
     One unseen topic, from the strand you have done least recently, biased
     toward the dimension you are currently worst at. */
  r.post('/api/interview/sessions', async (_req, res) => {
    const recent = await prisma.interviewSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: { rounds: true },
    });
    const { weakest } = trend(recent);

    let topic = await pickTopic({ weakest });

    // Cold start: nothing written yet. Write one batch in the foreground —
    // this is the only place in the app that waits on the model, and only
    // ever on the very first run.
    if (!topic) {
      try {
        await ensureTopics();
      } catch {
        /* reported below */
      }
      topic = await pickTopic({ weakest });
    }
    if (!topic) {
      return res.status(503).json({
        error: process.env.ANTHROPIC_API_KEY
          ? 'No interview topics are ready yet. They are being written — try again in a minute.'
          : 'ANTHROPIC_API_KEY is not set on the server, so no topics can be written.',
      });
    }

    const [session] = await prisma.$transaction([
      prisma.interviewSession.create({
        data: {
          topicId: topic.id,
          strand: topic.strand,
          prompt: topic.prompt,
          context: topic.context,
        },
        include: { rounds: true },
      }),
      prisma.interviewTopic.update({ where: { id: topic.id }, data: { usedAt: new Date() } }),
    ]);

    // Spend one, write more.
    ensureTopics().catch(() => {});

    res.json(shapeSession(session));
  });

  r.get('/api/interview/sessions/:id', async (req, res) => {
    const s = await prisma.interviewSession.findUnique({
      where: { id: req.params.id },
      include: { rounds: true },
    });
    if (!s) return res.status(404).json({ error: 'That sitting is not here. It may have been deleted.' });
    res.json(shapeSession(s));
  });

  /** Prep notes and the prep clock, saved as you type. */
  r.patch('/api/interview/sessions/:id', async (req, res) => {
    const data = {};
    if (req.body?.notes !== undefined) data.notes = String(req.body.notes);
    if (req.body?.prepSec !== undefined) data.prepSec = Math.max(0, Math.round(Number(req.body.prepSec) || 0));
    if (req.body?.stage !== undefined) {
      const stage = String(req.body.stage);
      // The client may only move forward through the two recording stages.
      // Everything else is set by the server when a critique lands, so a
      // stale tab cannot roll a marked session back to unmarked.
      if (!['answering', 'followup'].includes(stage)) {
        return res.status(400).json({ error: `The client cannot set the stage to "${stage}".` });
      }
      data.stage = stage;
    }

    const s = await prisma.interviewSession.update({
      where: { id: req.params.id },
      data,
      include: { rounds: true },
    });
    res.json(shapeSession(s));
  });

  r.delete('/api/interview/sessions/:id', async (req, res) => {
    await prisma.interviewSession.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });

  /* ---- submit an answer and have it marked ----
     Synchronous on purpose. The critique is the product; a person who has just
     spoken for four minutes is willing to watch a spinner for one, and a
     background job here would mean a second place for the result to get lost. */
  r.post('/api/interview/sessions/:id/rounds', async (req, res) => {
    const session = await prisma.interviewSession.findUnique({
      where: { id: req.params.id },
      include: { rounds: true },
    });
    if (!session) return res.status(404).json({ error: 'That sitting is not here. It may have been deleted.' });

    const transcript = String(req.body?.transcript || '').trim();
    const seconds = Math.max(0, Math.min(3600, Math.round(Number(req.body?.seconds) || 0)));

    if (words(transcript) < MIN_WORDS) {
      return res.status(400).json({
        error: `There are only ${words(transcript)} words here. Speech recognition may not have picked you up — check the microphone, then record again.`,
      });
    }

    const done = session.rounds.filter((x) => x.critique).length;
    const n = done + 1;
    if (n > 2) return res.status(400).json({ error: 'Both rounds are already marked on this sitting.' });

    const first = [...session.rounds].sort((a, b) => a.n - b.n)[0];
    const question = n === 1 ? session.prompt : first?.critique?.followUp || first?.followUp || '';
    if (n === 2 && !question) {
      return res.status(400).json({ error: 'There is no follow-up question on this sitting yet. Mark the first round.' });
    }

    await prisma.interviewSession.update({ where: { id: session.id }, data: { stage: 'marking' } });

    let marked;
    try {
      marked = await critique({
        round: n,
        strand: session.strand,
        prompt: session.prompt,
        context: session.context,
        notes: session.notes,
        transcript,
        seconds,
        question,
        first: first ? { transcript: first.transcript, seconds: first.seconds } : null,
      });
    } catch (e) {
      // Put the stage back so the answer can be re-submitted rather than the
      // sitting being stuck at "marking" forever.
      await prisma.interviewSession.update({
        where: { id: session.id },
        data: { stage: n === 1 ? 'answering' : 'followup' },
      });
      return res.status(502).json({ error: e.message });
    }

    const followUp = n === 1 ? marked.followUp : '';

    await prisma.$transaction([
      prisma.interviewRound.create({
        data: {
          sessionId: session.id,
          n,
          question,
          transcript,
          seconds,
          scores: marked.flat,
          critique: { ...marked.critique, followUp },
          modelAnswer: marked.modelAnswer,
          sources: marked.sources,
        },
      }),
      prisma.interviewSession.update({
        where: { id: session.id },
        data: {
          stage: n === 1 ? 'round1' : 'done',
          // The verdict belongs to round two — that is where the real
          // assessment is, so a round-one weakness is provisional.
          weakness: n === 2 ? marked.biggestWeakness : session.weakness,
          nextTime: n === 2 ? marked.nextTime : session.nextTime,
        },
      }),
    ]);

    const fresh = await prisma.interviewSession.findUnique({
      where: { id: session.id },
      include: { rounds: true },
    });
    res.json(shapeSession(fresh));
  });
}
