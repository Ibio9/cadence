/**
 * The TARA taxonomy.
 *
 * One source of truth, on the server, served to the web app rather than
 * duplicated in it. Question writing validates against it, the drill tree
 * renders from it, and the progress view groups by it — so a subcategory that
 * exists here exists everywhere, and one that does not cannot be written to.
 *
 * Three modules. Critical Thinking is flat: seven question types, which is how
 * the paper is actually built. Problem Solving is two levels, because the
 * three official operations are the real division and the genres beneath them
 * are how you practise. The Writing Task is not divided at all — the practice
 * is three prompts, pick one, write, get marked.
 */

/* --------------------------------------------------------------------------
   Timing
   -------------------------------------------------------------------------- */

/** 22 questions in 40 minutes. Written per question so the drill can hold you
 *  to the real budget on a set of any length. */
export const CT_SECONDS_PER_Q = 110; // 1m 50s
export const PS_SECONDS_PER_Q = 109; // just under 2 minutes
export const MODULE_QUESTIONS = 22;
export const MODULE_MINUTES = 40;
export const WRITING_MINUTES = 40;
export const WRITING_WORD_LIMIT = 750;
export const WRITING_PROMPT_COUNT = 3;

/* --------------------------------------------------------------------------
   Module 1 — Critical Thinking
   -------------------------------------------------------------------------- */

const CT_SUBCATEGORIES = [
  {
    id: 'main-conclusion',
    name: 'Identifying the Main Conclusion',
    attack:
      'Find the claim everything else supports. Test each candidate with "therefore": the conclusion is the one the others lead to, never the one that leads anywhere.',
  },
  {
    id: 'drawing-conclusion',
    name: 'Drawing a Conclusion',
    attack:
      'Take the statements as given and find what must follow. Not what is likely, not what is reasonable — what cannot be false if they are true.',
  },
  {
    id: 'assumption',
    name: 'Identifying an Assumption',
    attack:
      'Find the unstated premise the argument needs. Negate the candidate: if the argument collapses, it is the assumption; if it survives, it is not.',
  },
  {
    id: 'additional-evidence',
    name: 'Assessing Additional Evidence',
    attack:
      'Ask what the new fact does to the gap between premises and conclusion. Strengthen closes it, weaken widens it, and most options do neither.',
  },
  {
    id: 'reasoning-errors',
    name: 'Detecting Reasoning Errors',
    attack:
      'Name the flaw before you read the options. If you can say what went wrong in your own words, the right option is the one that says it back.',
  },
  {
    id: 'matching-arguments',
    name: 'Matching Arguments',
    attack:
      'Reduce the passage to its skeleton in letters, then match the skeleton — not the subject. If the passage is invalid, the answer must be invalid in the same way.',
  },
  {
    id: 'applying-principles',
    name: 'Applying Principles',
    attack:
      'State the principle as a rule with a trigger and a consequence. The answer is the case where the trigger genuinely fires.',
  },
];

/* --------------------------------------------------------------------------
   Module 2 — Problem Solving
   -------------------------------------------------------------------------- */

const PS_GROUPS = [
  {
    id: 'relevant-selection',
    name: 'Relevant Selection',
    blurb: 'Most of what is on the page does not matter. Find the part that does.',
    subcategories: [
      {
        id: 'timetables',
        name: 'Timetables',
        attack: 'Read the constraint first, then enter the table once. Never read the whole table.',
      },
      {
        id: 'tables',
        name: 'Tables and price lists',
        attack: 'Identify the single row or column the question turns on before doing any arithmetic.',
      },
      {
        id: 'multi-constraint',
        name: 'Multi-constraint',
        attack: 'Apply the constraint that eliminates most options first, then the next.',
      },
    ],
  },
  {
    id: 'finding-procedures',
    name: 'Finding Procedures',
    blurb: 'The numbers are easy. Working out what to do with them is the question.',
    subcategories: [
      {
        id: 'percentages-ratios',
        name: 'Percentages and ratios',
        attack: 'Fix what the percentage is of before computing. Most errors are a wrong base.',
      },
      {
        id: 'rates',
        name: 'Rates, speed and work',
        attack: 'Write the rate as a fraction with its units and cancel. The units tell you the operation.',
      },
      { id: 'money', name: 'Money', attack: 'Work in whole pence where you can, and round only at the end.' },
      {
        id: 'counting',
        name: 'Counting and combinations',
        attack: 'Decide whether order matters and whether repeats are allowed before you count anything.',
      },
      {
        id: 'area-volume-scaling',
        name: 'Area, volume and scaling',
        attack: 'Lengths scale by k, areas by k squared, volumes by k cubed. Name k first.',
      },
    ],
  },
  {
    id: 'identifying-similarity',
    name: 'Identifying Similarity',
    blurb: 'The same information, shown a second way. Decide whether the two really match.',
    subcategories: [
      {
        id: 'charts-vs-tables',
        name: 'Charts against tables',
        attack: 'Check one extreme point and one total. A chart that misrepresents usually breaks on both.',
      },
      {
        id: 'nets-folding',
        name: 'Nets and folding',
        attack: 'Track one face and the two faces adjacent to it. Opposite faces never touch on the net.',
      },
      {
        id: 'rotations',
        name: 'Rotations and reflections',
        attack: 'Find one asymmetric feature and follow only that. A reflection cannot be rotated into place.',
      },
      {
        id: 'dice',
        name: 'Dice',
        attack: 'Opposite faces sum to seven on a standard die, and the three faces at a corner fix the handedness.',
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   The modules
   -------------------------------------------------------------------------- */

export const MODULES = [
  {
    id: 'ct',
    name: 'Critical Thinking',
    blurb: 'Arguments in words. Twenty-two questions, forty minutes, five options each.',
    kind: 'mcq',
    questions: MODULE_QUESTIONS,
    minutes: MODULE_MINUTES,
    secondsPerQuestion: CT_SECONDS_PER_Q,
    flat: true,
    subcategories: CT_SUBCATEGORIES,
  },
  {
    id: 'ps',
    name: 'Problem Solving',
    blurb: 'Numbers, tables and shapes. Twenty-two questions, forty minutes, five options each.',
    kind: 'mcq',
    questions: MODULE_QUESTIONS,
    minutes: MODULE_MINUTES,
    secondsPerQuestion: PS_SECONDS_PER_Q,
    flat: false,
    groups: PS_GROUPS,
    subcategories: PS_GROUPS.flatMap((g) =>
      g.subcategories.map((s) => ({ ...s, group: g.id, groupName: g.name })),
    ),
  },
  {
    id: 'writing',
    name: 'Writing Task',
    blurb: 'One essay from three prompts. 750 words, forty minutes.',
    kind: 'essay',
    minutes: WRITING_MINUTES,
    wordLimit: WRITING_WORD_LIMIT,
    promptCount: WRITING_PROMPT_COUNT,
    flat: true,
    subcategories: [],
  },
];

/* --------------------------------------------------------------------------
   Lookups
   -------------------------------------------------------------------------- */

export const MODULE_IDS = MODULES.map((m) => m.id);
export const MCQ_MODULE_IDS = MODULES.filter((m) => m.kind === 'mcq').map((m) => m.id);

const BY_MODULE = Object.fromEntries(MODULES.map((m) => [m.id, m]));

export const getModule = (id) => BY_MODULE[id] || null;

/** Every drillable leaf, flattened, each carrying the module it belongs to. */
export const ALL_SUBCATEGORIES = MODULES.flatMap((m) =>
  m.subcategories.map((s) => ({ ...s, module: m.id, moduleName: m.name })),
);

const BY_KEY = Object.fromEntries(ALL_SUBCATEGORIES.map((s) => [`${s.module}:${s.id}`, s]));

export const getSubcategory = (module, id) => BY_KEY[`${module}:${id}`] || null;

/** True when this module/subcategory pair is one a question may be filed under. */
export const isValidSubcategory = (module, id) => Boolean(BY_KEY[`${module}:${id}`]);

/** Seconds a single question of this module is allowed to take. */
export const budgetFor = (module) => getModule(module)?.secondsPerQuestion ?? 110;
