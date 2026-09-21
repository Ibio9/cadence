/**
 * The reference material generation is built from.
 *
 * These are not prose for the reader — they are the construction kit. A
 * Critical Thinking question is built by choosing a flaw or a conditional form
 * and writing an argument that instantiates it, which is why the catalogue
 * lives here in a form a prompt can quote rather than as a paragraph of
 * description. The web app's reference tab renders the same material for
 * revision; this copy is the one the generator uses.
 */

/* --------------------------------------------------------------------------
   The four conditional forms
   -------------------------------------------------------------------------- */

/**
 * Two valid, two invalid. Most conditional questions in the paper are one of
 * these four wearing a subject, and the two invalid forms are the most
 * commonly tested reasoning errors there are.
 */
export const CONDITIONAL_FORMS = [
  {
    id: 'modus-ponens',
    name: 'Modus ponens',
    valid: true,
    skeleton: 'If P then Q. P. Therefore Q.',
    note: 'Valid. The only thing "if P then Q" lets you do with P.',
  },
  {
    id: 'modus-tollens',
    name: 'Modus tollens',
    valid: true,
    skeleton: 'If P then Q. Not Q. Therefore not P.',
    note: 'Valid, and the one people miss. Denying the consequent denies the antecedent.',
  },
  {
    id: 'affirming-consequent',
    name: 'Affirming the consequent',
    valid: false,
    skeleton: 'If P then Q. Q. Therefore P.',
    note: 'Invalid. Q may have arrived some other way — the conditional says nothing about that.',
  },
  {
    id: 'denying-antecedent',
    name: 'Denying the antecedent',
    valid: false,
    skeleton: 'If P then Q. Not P. Therefore not Q.',
    note: 'Invalid. P is one route to Q, not the only one.',
  },
];

/* --------------------------------------------------------------------------
   The flaw catalogue
   -------------------------------------------------------------------------- */

/**
 * Every flaw a Detecting Reasoning Errors question can turn on, and the
 * material Matching Arguments and Assessing Additional Evidence are built from
 * too. `id` is stored on the question so the progress view can say which flaws
 * are being missed by name rather than by count.
 */
export const FLAWS = [
  {
    id: 'affirming-consequent',
    name: 'Affirming the consequent',
    shape: 'If P then Q. Q. Therefore P.',
    tell: 'A conditional read backwards.',
  },
  {
    id: 'denying-antecedent',
    name: 'Denying the antecedent',
    shape: 'If P then Q. Not P. Therefore not Q.',
    tell: 'Treats the stated cause as the only possible one.',
  },
  {
    id: 'necessary-sufficient',
    name: 'Confusing necessary and sufficient',
    shape: 'X is needed for Y. We have X. Therefore Y.',
    tell: 'A requirement treated as a guarantee.',
  },
  {
    id: 'correlation-causation',
    name: 'Correlation taken for causation',
    shape: 'X and Y move together. Therefore X causes Y.',
    tell: 'No mechanism, no ruling out of the reverse direction.',
  },
  {
    id: 'post-hoc',
    name: 'Post hoc',
    shape: 'B happened after A. Therefore A caused B.',
    tell: 'Sequence offered as evidence of cause.',
  },
  {
    id: 'alternative-cause',
    name: 'Ignoring an alternative cause',
    shape: 'X explains Y. Therefore X caused Y.',
    tell: 'A plausible explanation treated as the only one.',
  },
  {
    id: 'hasty-generalisation',
    name: 'Hasty generalisation',
    shape: 'These few are F. Therefore all are F.',
    tell: 'A sample far too small for the claim it carries.',
  },
  {
    id: 'unrepresentative-sample',
    name: 'Unrepresentative sample',
    shape: 'This group is F. Therefore the population is F.',
    tell: 'The group was picked in a way that skews the result.',
  },
  {
    id: 'self-selection',
    name: 'Self-selection',
    shape: 'Those who volunteered report F. Therefore F holds generally.',
    tell: 'The people who opted in are not the people at large.',
  },
  {
    id: 'base-rate',
    name: 'Base-rate neglect',
    shape: 'Most F are G. This is G. Therefore it is probably F.',
    tell: 'Ignores how rare F was to begin with.',
  },
  {
    id: 'absolute-relative',
    name: 'Absolute and relative confused',
    shape: 'The percentage rose. Therefore the number rose.',
    tell: 'A proportion and a count swapped without warrant.',
  },
  {
    id: 'part-whole',
    name: 'Part and whole confused',
    shape: 'Each part is F. Therefore the whole is F.',
    tell: 'Composition, or its mirror, division.',
  },
  {
    id: 'false-dilemma',
    name: 'False dilemma',
    shape: 'Either A or B. Not A. Therefore B.',
    tell: 'Two options presented as if they were all of them.',
  },
  {
    id: 'circular',
    name: 'Circular reasoning',
    shape: 'P because Q. Q because P.',
    tell: 'The conclusion restated as its own support.',
  },
  {
    id: 'equivocation',
    name: 'Equivocation',
    shape: 'A term means one thing in the premise, another in the conclusion.',
    tell: 'A word doing two jobs.',
  },
  {
    id: 'straw-man',
    name: 'Straw man',
    shape: 'They claim X. X is absurd. Therefore they are wrong.',
    tell: 'A weaker claim refuted in place of the real one.',
  },
  {
    id: 'ad-hominem',
    name: 'Ad hominem',
    shape: 'They argue X. They are unreliable. Therefore not X.',
    tell: 'The arguer attacked instead of the argument.',
  },
  {
    id: 'appeal-authority',
    name: 'Misplaced appeal to authority',
    shape: 'An expert in one field says X. Therefore X.',
    tell: 'Authority outside its competence.',
  },
  {
    id: 'appeal-popularity',
    name: 'Appeal to popularity',
    shape: 'Most people believe X. Therefore X.',
    tell: 'Headcount offered as evidence.',
  },
  {
    id: 'slippery-slope',
    name: 'Slippery slope',
    shape: 'Allow A and B, then C, then disaster.',
    tell: 'A chain asserted without support for any link.',
  },
  {
    id: 'conflating-groups',
    name: 'Conflating two groups',
    shape: 'A claim about one population applied to a different one.',
    tell: 'The set changes between premise and conclusion.',
  },
  {
    id: 'proportion-trap',
    name: 'Proportion of the wrong total',
    shape: 'A share of one quantity compared with a share of another.',
    tell: 'Two percentages with different bases set side by side.',
  },
];

export const FLAW_IDS = FLAWS.map((f) => f.id);

const flawLine = (f) => `- ${f.id} — ${f.name}: ${f.shape} Tell: ${f.tell}`;
export const FLAW_CATALOGUE_TEXT = FLAWS.map(flawLine).join('\n');

const formLine = (f) =>
  `- ${f.id} — ${f.name} (${f.valid ? 'VALID' : 'INVALID'}): ${f.skeleton} ${f.note}`;
export const CONDITIONAL_FORMS_TEXT = CONDITIONAL_FORMS.map(formLine).join('\n');

/* --------------------------------------------------------------------------
   The Problem Solving maths ceiling
   -------------------------------------------------------------------------- */

/**
 * Everything a Problem Solving question is allowed to require, and nothing
 * else. The ceiling is the point of the module: the arithmetic is deliberately
 * easy so that the difficulty sits entirely in working out what to compute.
 */
export const PS_MATHS_CEILING = `ALLOWED, and nothing beyond it:
- simple fractions, place value, and the four rules
- percentages, ratio and proportion
- the mean (and, where stated, median and mode)
- time, money and measures
- perimeter, area and volume of ordinary shapes
- reading graphs, charts and tables
- metric conversion only: km/m/cm/mm and kg/g

FORBIDDEN:
- anything above GCSE
- simultaneous equations, quadratics, or algebra beyond a single trivial rearrangement
- trigonometry, logarithms, indices beyond squares and cubes, standard form
- calculus, probability distributions, compound-interest formulae
- imperial units, currency conversion, or any other conversion UNLESS the rate
  is supplied inside the question itself

NO CALCULATOR. Every question must have a route a person can run in their head
or on paper in under two minutes. If the route you intend needs long
multiplication of awkward numbers, division that does not come out, or heavy
algebra, the question is wrong — choose different numbers and rebuild it.`;

/* --------------------------------------------------------------------------
   Distractors
   -------------------------------------------------------------------------- */

/**
 * The rule that makes a wrong option worth having. A distractor nobody would
 * pick teaches nothing; a distractor that is exactly what you get from one
 * identifiable slip turns every wrong answer into a diagnosis.
 */
export const DISTRACTOR_RULE = `Every wrong option must be the answer to a specific, nameable mistake — not a
random number and not a vaguely wrong sentence. For each one, say which mistake
produces it, in the form "You get this by ...".

For Problem Solving, prefer distractors that come from: using the wrong base for
a percentage, inverting a ratio, forgetting one of the items, scaling area or
volume by the linear factor, off-by-one in a count, adding when the units call
for multiplying, reading the adjacent row or column, or stopping one step early.

For Critical Thinking, prefer distractors that are: true but irrelevant, a
restated premise offered as the conclusion, a claim that is too strong, a claim
about the wrong group, or the right idea reversed.`;
