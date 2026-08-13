/**
 * Question generation.
 *
 * Two things make this trustworthy rather than merely productive:
 *
 *   1. Structured outputs. The model is constrained to a JSON schema, so a
 *      question either arrives in the right shape or the request fails — there
 *      is no parsing of prose and no half-formed item reaching the bank.
 *
 *   2. Validation after the fact. The schema cannot express "the answer label
 *      must be one of the five options" or "every wrong option must be
 *      explained", so those are checked here and a question that fails is
 *      dropped, counted, and reported rather than saved. This is exam prep:
 *      a wrong question is worse than no question.
 *
 * The generator never invents a subcategory. It is told which one it is
 * writing for, and anything it returns is filed under that one.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CONDITIONAL_FORMS_TEXT,
  DISTRACTOR_RULE,
  FLAW_CATALOGUE_TEXT,
  FLAW_IDS,
  PS_MATHS_CEILING,
} from './catalogue.js';
import { getModule, getSubcategory } from './taxonomy.js';

const MODEL = 'claude-opus-5';
const LABELS = ['A', 'B', 'C', 'D', 'E'];

let client;
/** Built lazily so the server still boots and serves the bank without a key. */
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server, so nothing can be generated.');
  }
  client ??= new Anthropic();
  return client;
}

/* --------------------------------------------------------------------------
   The output contract
   -------------------------------------------------------------------------- */

const QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          passage: {
            type: 'string',
            description:
              'The stimulus. For Critical Thinking, the argument. For Problem Solving, the scenario and any data, with tables written as plain aligned text. Empty string only if the stem is genuinely self-contained.',
          },
          stem: { type: 'string', description: 'The question, asked separately from the passage.' },
          options: {
            type: 'array',
            description: 'Exactly five, labelled A to E in order.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', enum: LABELS },
                text: { type: 'string' },
              },
              required: ['label', 'text'],
              additionalProperties: false,
            },
          },
          answer: { type: 'string', enum: LABELS },
          route: {
            type: 'string',
            description:
              'For Problem Solving: the calculator-free route, at most three steps, with the actual numbers. For Critical Thinking: the argument skeleton in letters.',
          },
          why: { type: 'string', description: 'Why the key is correct.' },
          distractors: {
            type: 'array',
            description: 'One entry for each of the four options that are not the answer.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', enum: LABELS },
                why: {
                  type: 'string',
                  description: 'The specific mistake that produces this option, as "You get this by ...".',
                },
              },
              required: ['label', 'why'],
              additionalProperties: false,
            },
          },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          flaw: {
            type: 'string',
            description:
              'For Critical Thinking, the flaw-catalogue id the question turns on, or an empty string where none applies. Always empty for Problem Solving.',
          },
        },
        required: ['passage', 'stem', 'options', 'answer', 'route', 'why', 'distractors', 'difficulty', 'flaw'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

/* --------------------------------------------------------------------------
   Prompts
   -------------------------------------------------------------------------- */

const SHARED = `You write questions for a UK university admissions test. The person drilling
them is seventeen, sitting the real paper in a few weeks, and will treat every
question you write as if it came from a past paper. A question with two
defensible answers, or a key that is not actually correct, does direct damage.
Accuracy first, every time; polish is worth nothing here.

Rules that hold for every question:
- Exactly five options, labelled A to E. Exactly one is defensibly correct.
- The other four must be clearly wrong to someone who has reasoned properly,
  and clearly tempting to someone who has made one specific mistake.
- No trick wording, no double negatives for their own sake, no ambiguity about
  what is being asked.
- Never signal the answer by making it the longest, the most hedged, or the
  most detailed option. Vary which label is correct.
- No real named people, organisations or brands. No subject knowledge beyond
  what any applicant would have.
- British spelling.

${DISTRACTOR_RULE}`;

const CT_TYPE_RULES = {
  'main-conclusion': `Write a short argument (three to five sentences) with one main conclusion and
several supporting claims. The conclusion must NOT be flagged with "therefore"
or "so" — that would give it away. Bury it: put it first or in the middle at
least half the time.
The four wrong options must be drawn from the passage itself: a premise, an
intermediate conclusion, a restatement of a premise in the conclusion's words,
and a claim the passage mentions only to reject.`,

  'drawing-conclusion': `Give two to four statements that together entail exactly one of the options.
The key must FOLLOW NECESSARILY — not merely be likely or reasonable. Check it:
if you can construct any situation where the statements are true and the key is
false, the question is broken; rebuild it.
Wrong options should be: too strong (a universal where only a particular
follows), the converse, a claim about a group the statements never covered, and
something merely plausible but unsupported.`,

  assumption: `Write an argument with a clearly missing premise. The key is the unstated claim
the argument NEEDS — not a claim that would merely help it.
Apply the negation test yourself before you finish: negate the key, and the
argument must collapse. Negate each wrong option, and the argument must survive.
State the result of that test in the "why" field.
Wrong options should include: something the argument already states, something
stronger than the argument needs, and something relevant but not required.`,

  'additional-evidence': `Write an argument, then ask which option most strengthens it or most weakens it
— say which in the stem, and mean it.
The key must act on the gap between the premises and the conclusion. Wrong
options should be: relevant to the topic but not to the inference, an effect
rather than a cause, something that acts on a claim the argument does not make,
and one that acts in the opposite direction to the one asked for.`,

  'reasoning-errors': `Write an argument that commits exactly ONE identifiable flaw from the catalogue,
and set the "flaw" field to its id. Ask which option best describes what is
wrong with the reasoning.
The key must name the flaw in plain words without using the textbook label.
Wrong options should be: a different catalogue flaw the argument does not
commit, a true observation about the passage that is not the flaw, a complaint
about the truth of a premise rather than the reasoning, and a description of
the flaw with the terms reversed.`,

  'matching-arguments': `Write a short passage argument, then ask which option uses the most similar
pattern of reasoning.
This is the strictest type, so build it in this order:
1. Choose a skeleton in letters (e.g. "All A are B; c is not B; so c is not A")
   and set "route" to it.
2. Decide whether it is valid or invalid. If INVALID, name the flaw in the
   "flaw" field, and the correct option MUST commit the SAME invalidity — not a
   different one, and not a valid version of it.
3. Write the passage on one subject and the correct option on a completely
   unrelated subject.
4. SCRAMBLE THE ORDER of the statements in the correct option relative to the
   passage — conclusion first where the passage put it last, and so on. The
   real paper does this and matching by position must not work.
Wrong options should be: the same subject as the passage but a different
skeleton, the right skeleton with one term swapped, a valid version where the
passage was invalid, and a superficially similar argument with a different
quantifier.`,

  'applying-principles': `State a principle as a rule with a clear trigger and a clear consequence, then
ask which option it applies to — or, sometimes, give a case and ask which
principle it illustrates.
The key must be the case where the trigger genuinely fires and the consequence
genuinely follows.
Wrong options should be: a case that nearly fires the trigger, a case that fires
it but where the consequence is already the case anyway, a case governed by a
different consideration, and a case that fires a reversed version of the rule.`,
};

const PS_GENRE_RULES = {
  timetables: 'Build a small timetable (four to six services, three to five stops) as aligned plain text. Ask something that needs one entry and one constraint — a latest departure, a connection with a minimum change time, a total journey.',
  tables: 'Build a small table or price list as aligned plain text. Ask something answerable from one or two cells, with the rest of the table there to be ignored.',
  'multi-constraint': 'Give three or four constraints and a small set of candidates. Exactly one candidate satisfies all of them. The constraints should eliminate in a sensible order so the route is short.',
  'percentages-ratios': 'Turn on which quantity the percentage or ratio is taken of. At least two distractors should come from using the wrong base or inverting the ratio.',
  rates: 'Speed, work rate, flow, or unit price. Keep the numbers such that the division is exact.',
  money: 'Costs, discounts, change, best value between offers. Work in whole pence where that keeps it clean.',
  counting: 'Arrangements, selections, or systematic listing. Small enough that a careful list is a valid route. Say clearly whether order matters and whether repeats are allowed.',
  'area-volume-scaling': 'Perimeter, area, volume, or the effect of scaling a length by a factor. Include at least one distractor from scaling area or volume by the linear factor.',
  'charts-vs-tables': 'Give a table of data and describe (in plain text) a chart said to represent it, or four candidate descriptions. Ask which representation matches. Make the mismatch a real one — a wrong total, a reversed order, a misplaced extreme.',
  'nets-folding': 'Describe a net in plain text — an unambiguous grid of labelled squares with the shape spelled out. Ask which cube or solid it folds into, or which face lands opposite which. Describe the options unambiguously in words.',
  rotations: 'Describe a shape or arrangement with at least one asymmetric feature, in words precise enough to be unambiguous. Ask which option is the same figure rotated, and include a reflection as a distractor.',
  dice: 'Standard die conventions may be assumed: opposite faces sum to seven. State any non-standard convention explicitly in the passage.',
};

function buildPrompt({ module, subcategory, count, difficulty, avoid }) {
  const mod = getModule(module);
  const sub = getSubcategory(module, subcategory);
  const level =
    difficulty === 'mixed'
      ? 'Mix the difficulties: roughly one easy, the rest medium, and at most one hard.'
      : `Write all of them at "${difficulty}" difficulty.`;

  const avoidBlock = avoid?.length
    ? `\nDo not reuse these scenarios or arguments — they are already in the bank:\n${avoid
        .map((s) => `- ${s}`)
        .join('\n')}\n`
    : '';

  if (module === 'ct') {
    return `${SHARED}

MODULE: Critical Thinking.
QUESTION TYPE: ${sub.name}.
How this type is attacked: ${sub.attack}

${CT_TYPE_RULES[subcategory]}

THE FOUR CONDITIONAL FORMS — use these exactly, and never call an invalid form valid:
${CONDITIONAL_FORMS_TEXT}

THE FLAW CATALOGUE — the "flaw" field must be one of these ids, or an empty string:
${FLAW_CATALOGUE_TEXT}

Passages should be 40–110 words: long enough to have real structure, short
enough to read in under a minute.
Set "route" to the argument's skeleton in letters.
${level}
${avoidBlock}
Write ${count} question${count === 1 ? '' : 's'}.`;
  }

  return `${SHARED}

MODULE: Problem Solving.
OPERATION: ${sub.groupName}.
GENRE: ${sub.name}.
How this genre is attacked: ${sub.attack}
${PS_GENRE_RULES[subcategory] ? `\nFor this genre specifically: ${PS_GENRE_RULES[subcategory]}` : ''}

${PS_MATHS_CEILING}

Before you finish each question, run your own route in the "route" field with
the real numbers and confirm it lands on the key. If the arithmetic is not
clean, change the numbers and run it again. Set "flaw" to an empty string.

Any table, timetable or chart must be written as plain monospaced text with
aligned columns, inside the passage. Do not reference an image — there are no
images.
${level}
${avoidBlock}
Write ${count} question${count === 1 ? '' : 's'}.`;
}

/* --------------------------------------------------------------------------
   Validation
   -------------------------------------------------------------------------- */

/**
 * What the schema could not enforce. A question failing any of these is
 * dropped: an item with a mislabelled key or an unexplained distractor is
 * actively misleading to drill against.
 */
export function validateQuestion(q, module) {
  const opts = Array.isArray(q.options) ? q.options : [];
  if (opts.length !== 5) return `expected 5 options, got ${opts.length}`;

  const labels = opts.map((o) => o.label);
  if (new Set(labels).size !== 5) return 'duplicate option labels';
  if (LABELS.some((l) => !labels.includes(l))) return 'options are not labelled A to E';
  if (opts.some((o) => !o.text?.trim())) return 'an option is empty';

  const texts = opts.map((o) => o.text.trim().toLowerCase());
  if (new Set(texts).size !== 5) return 'two options say the same thing';

  if (!LABELS.includes(q.answer)) return `answer "${q.answer}" is not a label`;

  const given = Array.isArray(q.distractors) ? q.distractors : [];
  const wrong = LABELS.filter((l) => l !== q.answer);
  const covered = new Set(given.map((d) => d.label));
  if (covered.has(q.answer)) return 'the key is listed as a distractor';
  const missing = wrong.filter((l) => !covered.has(l));
  if (missing.length) return `no explanation for option ${missing.join(', ')}`;
  if (given.some((d) => !d.why?.trim())) return 'a distractor explanation is empty';

  if (!q.stem?.trim()) return 'empty stem';
  if (!q.why?.trim()) return 'empty explanation';
  // The no-calculator guarantee is only worth having if it is written down.
  if (module === 'ps' && !q.route?.trim()) return 'no calculator-free route given';
  if (q.flaw && !FLAW_IDS.includes(q.flaw)) return `unknown flaw "${q.flaw}"`;

  return null;
}

/* --------------------------------------------------------------------------
   Generate
   -------------------------------------------------------------------------- */

/**
 * Ask for `count` questions and return only the ones that survive validation,
 * alongside the reasons the others were thrown away. The caller decides
 * whether a short batch is worth retrying; nothing invalid is ever persisted.
 */
export async function generateQuestions({ module, subcategory, count = 5, difficulty = 'mixed', avoid = [] }) {
  const sub = getSubcategory(module, subcategory);
  if (!sub) throw new Error(`${module}/${subcategory} is not a subcategory.`);
  if (module === 'writing') throw new Error('The writing task is not multiple choice.');

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    // Question writing is the part of this app where being wrong costs the
    // most, so it runs at high effort regardless of batch size.
    output_config: { effort: 'high', format: { type: 'json_schema', schema: QUESTION_SCHEMA } },
    messages: [{ role: 'user', content: buildPrompt({ module, subcategory, count, difficulty, avoid }) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to write these questions.');
  }

  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('The model returned nothing to read.');

  const parsed = JSON.parse(text);
  const kept = [];
  const rejected = [];

  for (const q of parsed.questions || []) {
    const problem = validateQuestion(q, module);
    if (problem) {
      rejected.push({ stem: (q.stem || '').slice(0, 80), problem });
      continue;
    }
    kept.push({
      module,
      subcategory,
      passage: (q.passage || '').trim(),
      stem: q.stem.trim(),
      options: q.options.map((o) => ({ label: o.label, text: o.text.trim() })),
      answer: q.answer,
      route: (q.route || '').trim(),
      why: q.why.trim(),
      distractors: q.distractors.map((d) => ({ label: d.label, why: d.why.trim() })),
      difficulty: q.difficulty || 'medium',
      origin: 'generated',
      flaw: q.flaw || null,
    });
  }

  return { kept, rejected };
}
