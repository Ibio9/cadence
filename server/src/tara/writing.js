/**
 * The writing task: prompts, marking, and the model answer.
 *
 * Marking and the model answer are one call, not two, because the last
 * deliverable is a comparison — the alternative has to be written with the
 * essay in front of it, or "where you diverged" is guesswork.
 *
 * The marking is deliberately unkind. An essay that reads well but never
 * answers the second question has failed at the thing the task is actually
 * testing, and a mark that averages that away teaches nothing nine weeks out.
 */

import Anthropic from '@anthropic-ai/sdk';
import { WRITING_WORD_LIMIT } from './taxonomy.js';

const MODEL = 'claude-opus-5';

let client;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server, so nothing can be generated.');
  }
  client ??= new Anthropic();
  return client;
}

/* --------------------------------------------------------------------------
   Prompts
   -------------------------------------------------------------------------- */

const PROMPT_SCHEMA = {
  type: 'object',
  properties: {
    prompts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          statement: { type: 'string', description: 'The short statement, one sentence.' },
          q1: { type: 'string', description: 'Explain what you think is meant by the statement.' },
          q2: { type: 'string', description: 'Give a reasoned argument against the statement.' },
          q3: { type: 'string', description: 'To what extent do you agree?' },
        },
        required: ['statement', 'q1', 'q2', 'q3'],
        additionalProperties: false,
      },
    },
  },
  required: ['prompts'],
  additionalProperties: false,
};

const PROMPT_SYSTEM = `You write essay prompts for a UK university admissions test.

The shape is fixed. A short statement — one sentence, arguable, slightly
provocative, never a question — followed by three questions in this order:
  1. Explain what you think is meant by the statement.
  2. Give a reasoned argument against it.
  3. To what extent do you agree?

Word the three questions naturally around the statement's own terms rather than
repeating a template verbatim, but keep them in that order and keep what each
one asks unchanged.

Hard requirements:
- NO SUBJECT KNOWLEDGE. Any applicant, from any set of A-levels, must be able to
  write 750 good words on it from general reasoning alone. Nothing that rewards
  having studied economics, law, medicine or philosophy.
- Genuinely two-sided. If the honest answer is obviously yes or obviously no,
  the prompt is dead — rewrite it.
- The statement must contain a term or claim worth unpacking in part 1. That is
  what makes part 1 more than paraphrase.
- Not about current events, named people, organisations, or anything that dates.
- British spelling. Plain words, no rhetorical flourish.

Make the three prompts genuinely different from each other in subject and in
the kind of thinking they reward.`;

/** Three prompts in the official shape, ready to choose between. */
export async function generatePrompts({ count = 3, avoid = [] } = {}) {
  const avoidBlock = avoid.length
    ? `\n\nDo not write anything close to these, which have already been used:\n${avoid.map((s) => `- ${s}`).join('\n')}`
    : '';

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: PROMPT_SCHEMA } },
    system: PROMPT_SYSTEM,
    messages: [{ role: 'user', content: `Write ${count} prompts.${avoidBlock}` }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The model declined to write prompts.');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('The model returned nothing to read.');

  const parsed = JSON.parse(text);
  return (parsed.prompts || [])
    .filter((p) => p.statement?.trim() && p.q1?.trim() && p.q2?.trim() && p.q3?.trim())
    .map((p) => ({
      statement: p.statement.trim(),
      q1: p.q1.trim(),
      q2: p.q2.trim(),
      q3: p.q3.trim(),
      origin: 'generated',
    }));
}

/* --------------------------------------------------------------------------
   Marking
   -------------------------------------------------------------------------- */

/** The criteria, in the order they are reported. Ids are stable so the
 *  progress view can track the same criterion across essays. */
export const CRITERIA = [
  {
    id: 'three-parts',
    name: 'All three parts addressed',
    test: 'Is each of the three questions genuinely answered, at reasonable length? Missing part 2, or treating part 3 as a summary of part 1 rather than a judgement, is a structural failure regardless of how well the prose reads.',
  },
  {
    id: 'exact-wording',
    name: 'Engages the exact statement',
    test: 'Does it argue about what the statement actually says, including its specific terms and its scope — or does it drift into the general topic area?',
  },
  {
    id: 'precision',
    name: 'Precise and grouped',
    test: 'Are the points distinct, sharply put, and grouped so that related ones sit together — or repetitive, scattered, and circling the same idea?',
  },
  {
    id: 'examples',
    name: 'Examples load-bearing',
    test: 'Does each example do argumentative work, or is it decoration? Flag any argument that rests solely on an example, with no reasoning connecting it to the claim.',
  },
  {
    id: 'counter-argument',
    name: 'Counter-argument at full strength',
    test: 'Is the argument against the statement the strongest available version, or a weakened one that is easy to knock down?',
  },
  {
    id: 'conclusion',
    name: 'Conclusion argued, not summarised',
    test: 'Does the final judgement follow from what came before and take a position — or does it merely restate the essay?',
  },
  {
    id: 'mechanics',
    name: 'Spelling and grammar',
    test: 'There is no spell-checker in the real thing. Flag every slip.',
  },
];

const MARK_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            enum: CRITERIA.map((c) => c.id),
          },
          verdict: { type: 'string', enum: ['met', 'partial', 'failed'] },
          evidence: {
            type: 'string',
            description: 'What in the essay shows this, quoting it directly where possible.',
          },
          fix: { type: 'string', description: 'The single most useful change for this criterion.' },
        },
        required: ['id', 'verdict', 'evidence', 'fix'],
        additionalProperties: false,
      },
    },
    structuralFailure: {
      type: 'boolean',
      description: 'True if a whole part is missing or part 3 is a summary rather than a judgement.',
    },
    structuralNote: { type: 'string', description: 'One sentence. Empty if there is no structural failure.' },
    typos: {
      type: 'array',
      description: 'Every spelling, grammar or punctuation slip. Do not summarise; list them.',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string', description: 'The exact text as written, a few words only.' },
          problem: { type: 'string' },
          correction: { type: 'string' },
        },
        required: ['quote', 'problem', 'correction'],
        additionalProperties: false,
      },
    },
    score: { type: 'integer', description: 'Out of 10. Be hard: 5 is a competent essay with real faults.' },
    verdict: { type: 'string', description: 'Two or three sentences. Lead with the biggest problem.' },
    exemplar: {
      type: 'string',
      description: 'A complete answer to the same prompt, 700-750 words, addressing all three parts.',
    },
    divergences: {
      type: 'array',
      description: 'The three to six places the essay most differs from the model answer.',
      items: {
        type: 'object',
        properties: {
          mine: { type: 'string', description: "A sentence quoted verbatim from the person's essay." },
          alternative: { type: 'string', description: 'The corresponding move in the model answer.' },
          note: { type: 'string', description: 'What the difference costs, in one sentence.' },
        },
        required: ['mine', 'alternative', 'note'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'criteria',
    'structuralFailure',
    'structuralNote',
    'typos',
    'score',
    'verdict',
    'exemplar',
    'divergences',
  ],
  additionalProperties: false,
};

const MARK_SYSTEM = `You mark essays for a UK university admissions test, for one person preparing
to sit it. Mark hard. An encouraging mark is a useless mark: they will find out
the truth in the exam hall, and the only version of this that helps is the one
that names what is wrong now, while there is still time to fix it.

Marking rules:
- Judge what is on the page, not what they probably meant.
- Quote the essay when you make a claim about it. Never characterise without
  evidence.
- "partial" is not a polite way of saying "met". Use "failed" when it failed.
- A missing part, or a part 3 that summarises rather than judges, is a
  STRUCTURAL FAILURE. Say so, and let it dominate the verdict no matter how
  good the prose is.
- List every spelling, grammar and punctuation error individually. There is no
  spell-checker in the real thing, so a typo is a real cost. Do not round them
  up into "a few typos".
- Score out of 10, where 5 is a competent essay with real faults, 7 is genuinely
  good, and 9+ is close to the best an applicant could write under time. Most
  first attempts are 4 to 6. Do not inflate.

Then write the model answer: a complete response to the same prompt in 700-750
words, answering all three parts in order, at the standard of a very strong
applicant working under time. It should be plainly better than what they wrote
and clearly achievable — not a polished essay written at leisure.

Finally, pick the three to six places where their essay most diverges from
yours. Quote their sentence verbatim, say what the model answer does instead,
and say in one sentence what the difference costs them.

British spelling throughout.`;

/**
 * Mark one essay, write the model answer, and compare the two. Returns the
 * structured mark; the caller persists it against the essay.
 */
export async function markEssay({ prompt, text, seconds }) {
  const words = countWords(text);
  const overLimit = words > WRITING_WORD_LIMIT;

  const body = `THE PROMPT

Statement: ${prompt.statement}

1. ${prompt.q1}
2. ${prompt.q2}
3. ${prompt.q3}

CONDITIONS
Word count: ${words}${overLimit ? ` — OVER the ${WRITING_WORD_LIMIT}-word limit, which is itself a fault` : ''}
Time taken: ${Math.round((seconds || 0) / 60)} minutes of the 40 allowed

THE ESSAY

${text}

---

Mark it against these criteria, one entry each, in this order:
${CRITERIA.map((c, i) => `${i + 1}. ${c.id} — ${c.name}. ${c.test}`).join('\n')}`;

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: MARK_SCHEMA } },
    system: MARK_SYSTEM,
    messages: [{ role: 'user', content: body }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The model declined to mark this essay.');
  const out = response.content.find((b) => b.type === 'text')?.text;
  if (!out) throw new Error('The model returned nothing to read.');

  const parsed = JSON.parse(out);

  // Order the criteria the way they are defined rather than the way they came
  // back, so the report reads the same every time.
  const byId = Object.fromEntries((parsed.criteria || []).map((c) => [c.id, c]));
  const criteria = CRITERIA.map((c) => ({
    id: c.id,
    name: c.name,
    verdict: byId[c.id]?.verdict || 'partial',
    evidence: byId[c.id]?.evidence || '',
    fix: byId[c.id]?.fix || '',
  }));

  return {
    mark: {
      criteria,
      structuralFailure: Boolean(parsed.structuralFailure),
      structuralNote: parsed.structuralNote || '',
      typos: parsed.typos || [],
      score: clampScore(parsed.score),
      verdict: parsed.verdict || '',
      words,
      overLimit,
    },
    exemplar: parsed.exemplar || '',
    divergences: parsed.divergences || [],
  };
}

const clampScore = (n) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));

/** The same count the editor shows, so the limit means one thing everywhere. */
export function countWords(text) {
  return (String(text || '').trim().match(/\S+/g) || []).length;
}
