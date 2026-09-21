/**
 * Writing interview prompts.
 *
 * The pool is topped up in the background and drawn from on start, so pressing
 * start puts a question in front of you immediately. A drill you have to wait
 * ninety seconds to begin is a drill you do less often.
 *
 * Rotation is by strand, not random: three strands, and the next topic comes
 * from whichever one you have done least recently. Weak dimensions bias the
 * choice within that strand — if delivery is your worst score, you get the
 * prompts that punish hedging.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../db.js';
import { KINDS, KIND_IDS, STRANDS, STRAND_IDS, TOPIC_BATCH, TOPIC_FLOOR, getStrand } from './strands.js';

const MODEL = 'claude-opus-5';

let client;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server, so no topics can be written.');
  }
  client ??= new Anthropic();
  return client;
}

/* --------------------------------------------------------------------------
   The contract
   -------------------------------------------------------------------------- */

const TOPIC_SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          strand: { type: 'string', enum: STRAND_IDS },
          kind: { type: 'string', enum: KIND_IDS },
          prompt: {
            type: 'string',
            description:
              'The prompt exactly as a tutor would say it out loud. One or two sentences. Never a title, never an instruction, never the word "discuss".',
          },
          context: {
            type: 'string',
            description:
              'The single line of setup the tutor would give first, or an empty string where the prompt stands alone.',
          },
          tests: {
            type: 'string',
            description:
              'What this is actually testing, in one sentence, for the marker. Never shown to the candidate before they answer.',
          },
        },
        required: ['strand', 'kind', 'prompt', 'context', 'tests'],
        additionalProperties: false,
      },
    },
  },
  required: ['topics'],
  additionalProperties: false,
};

/* --------------------------------------------------------------------------
   The prompt
   -------------------------------------------------------------------------- */

function buildPrompt({ count, avoid }) {
  const strands = STRANDS.map(
    (s) => `${s.id} — ${s.name}\n  The tutor is watching for: ${s.watching}\n  Territory: ${s.territory}`,
  ).join('\n\n');

  const kinds = KINDS.map((k) => `${k.id} — ${k.name}\n  ${k.shape}`).join('\n\n');

  const avoidBlock = avoid?.length
    ? `\nThese are already in the pool. Do not write anything that turns on the same idea:\n${avoid
        .map((p) => `- ${p}`)
        .join('\n')}\n`
    : '';

  return `Write opening questions for an Oxford PPE interview.

You are writing what a tutor SAYS, at the start of an interview, to a candidate
who has had fifteen minutes with the question and is about to speak for three
to five minutes. You are not writing essay titles. The difference matters more
than anything else here:

  An essay title:  "Discuss the limits of democratic legitimacy."
  An interview prompt: "A referendum passes by one vote and abolishes the right
  it was called to protect. Was that democratic?"

The second one can be answered out loud, immediately, by someone thinking. The
first one cannot be answered at all — it can only be written about.

Rules for every prompt:
- One or two sentences. It must be sayable in under fifteen seconds.
- No "discuss", "evaluate", "to what extent", "critically assess", or any other
  essay-question verb.
- It must be answerable from thinking rather than from having read a particular
  book. A candidate who knows nothing about the specific literature but reasons
  well should be able to get somewhere.
- It must have somewhere to go. A tutor should be able to push back on any
  plausible answer.
- No named published thought experiment — no trolleys, no violinists, no veils,
  no Chinese rooms, no experience machines. The candidate should be meeting
  this case for the first time.
- British spelling. No preamble, no "here's a question for you".

THE THREE STRANDS:

${strands}

THE THREE SHAPES:

${kinds}

Spread the ${count} prompts evenly across the three strands, and use all three
shapes within each strand.
${avoidBlock}
Write ${count} prompts.`;
}

/* --------------------------------------------------------------------------
   Validation
   -------------------------------------------------------------------------- */

/**
 * The one failure the schema cannot catch: an essay title wearing a question
 * mark. Cheap to detect, and the cost of letting one through is a whole
 * fifteen-minute prep spent on the wrong kind of thinking.
 */
const ESSAY_TELLS = /\b(discuss|to what extent|critically (assess|evaluate)|evaluate the|examine the|analyse the|analyze the)\b/i;
const NAMED_CASES = /\btrolley|violinist|veil of ignorance|chinese room|experience machine|prisoner'?s dilemma\b/i;

export function validateTopic(t) {
  const prompt = (t.prompt || '').trim();
  if (!prompt) return 'empty prompt';
  if (prompt.length > 400) return 'too long to say out loud';
  if (ESSAY_TELLS.test(prompt)) return 'this is an essay title, not something a tutor would say';
  if (NAMED_CASES.test(prompt)) return 'uses a named published thought experiment';
  if (!STRAND_IDS.includes(t.strand)) return `unknown strand "${t.strand}"`;
  if (!KIND_IDS.includes(t.kind)) return `unknown kind "${t.kind}"`;
  if (!t.tests?.trim()) return 'no note on what it tests';
  return null;
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

export async function writeTopics({ count = TOPIC_BATCH } = {}) {
  const existing = await prisma.interviewTopic.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { prompt: true },
  });

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 12000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: TOPIC_SCHEMA } },
    messages: [{ role: 'user', content: buildPrompt({ count, avoid: existing.map((t) => t.prompt) }) }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The model declined to write these prompts.');

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('The model returned nothing to read.');

  const kept = [];
  const rejected = [];
  for (const t of JSON.parse(text).topics || []) {
    const problem = validateTopic(t);
    if (problem) {
      rejected.push({ prompt: (t.prompt || '').slice(0, 70), problem });
      continue;
    }
    kept.push({
      strand: t.strand,
      kind: t.kind,
      prompt: t.prompt.trim(),
      context: (t.context || '').trim(),
      tests: t.tests.trim(),
    });
  }

  if (kept.length) await prisma.interviewTopic.createMany({ data: kept });
  return { added: kept.length, rejected };
}

/* --------------------------------------------------------------------------
   Topping up
   -------------------------------------------------------------------------- */

let writing = false;

/**
 * Keep unseen topics above the floor, quietly. Same shape as the TARA bank:
 * measured against the database, safe to call from anywhere, never awaited by
 * a request handler.
 */
export async function ensureTopics() {
  if (writing) return;
  const unseen = await prisma.interviewTopic.count({ where: { usedAt: null } });
  if (unseen >= TOPIC_FLOOR) return;
  if (!process.env.ANTHROPIC_API_KEY) return;

  writing = true;
  try {
    await writeTopics({ count: TOPIC_BATCH });
  } catch (e) {
    console.error('[interview]', e.message);
  } finally {
    writing = false;
  }
}

export const isWritingTopics = () => writing;

/* --------------------------------------------------------------------------
   Choosing
   -------------------------------------------------------------------------- */

/**
 * The next topic: an unseen one, from the strand you have done least recently,
 * biased toward your weakest dimension.
 *
 * The strand rotation is the important half — three strands means philosophy
 * gets a third of your practice whether or not it is the one you enjoy, which
 * is the whole reason to rotate rather than choose.
 */
export async function pickTopic({ weakest } = {}) {
  const [pool, recent] = await Promise.all([
    prisma.interviewTopic.findMany({ where: { usedAt: null } }),
    prisma.interviewSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { strand: true, createdAt: true },
    }),
  ]);

  if (!pool.length) return null;

  // How long since each strand was last sat. Never sat sorts first.
  const lastAt = {};
  for (const s of recent) lastAt[s.strand] ??= new Date(s.createdAt).getTime();
  const strandOrder = [...STRAND_IDS].sort((a, b) => (lastAt[a] ?? 0) - (lastAt[b] ?? 0));
  const want = strandOrder[0];

  const inStrand = pool.filter((t) => t.strand === want);
  const candidates = inStrand.length ? inStrand : pool;

  /* The weakness bias. Delivery and structure are punished hardest by an
     ethical case, where you have to build a position under time pressure;
     reasoning and evidence by a counterintuitive result, where a stored fact
     will not save you. It is a nudge, not a rule — the strand rotation still
     decides which third of the syllabus you are in. */
  const prefer =
    weakest === 'delivery' || weakest === 'structure'
      ? 'case'
      : weakest === 'reasoning' || weakest === 'evidence'
        ? 'result'
        : null;

  const preferred = prefer ? candidates.filter((t) => t.kind === prefer) : [];
  const from = preferred.length ? preferred : candidates;

  return from[Math.floor(Math.random() * from.length)];
}
