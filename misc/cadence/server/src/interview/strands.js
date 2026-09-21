/**
 * The PPE interview: what gets asked, and what is being measured.
 *
 * An Oxford PPE interview is not an essay viva. The tutor puts something in
 * front of you — a claim, a result, a case — and watches you think about it in
 * real time. So the topic pool is written as things a tutor would *say*, not as
 * titles you could write about, and the three prompt kinds below are the three
 * shapes that actually turn up.
 */

/* --------------------------------------------------------------------------
   The three strands
   -------------------------------------------------------------------------- */

export const STRANDS = [
  {
    id: 'philosophy',
    name: 'Philosophy',
    /** What the tutor is fishing for when they open in this strand. */
    watching:
      'Whether you define your terms before using them, whether you can hold a distinction steady across three minutes, and whether you follow an argument to a conclusion you dislike.',
    territory:
      'Personal identity, free will and moral responsibility, knowledge and justification, the is/ought gap, utilitarianism and its objections, rights and their grounding, political obligation, the problem of other minds, vagueness, moral luck.',
  },
  {
    id: 'politics',
    name: 'Politics',
    watching:
      'Whether you can separate an empirical claim from a normative one, whether you notice when a mechanism is being asserted rather than shown, and whether you can argue against your own instinct.',
    territory:
      'Democratic legitimacy and its limits, representation, constitutions and judicial review, federalism, voting systems and their pathologies, populism, state capacity, the boundary between public and private, civil disobedience, international obligation.',
  },
  {
    id: 'economics',
    name: 'Economics',
    watching:
      'Whether you reason from a mechanism rather than a stored fact, whether you can carry a counterintuitive result to its conclusion, and whether you notice which assumption is doing the work.',
    territory:
      'Price mechanisms and shortages, externalities and their remedies, comparative advantage, incentives and unintended consequences, public goods, adverse selection and moral hazard, market power, minimum wages and monopsony, discounting the future, growth and its measurement.',
  },
];

export const STRAND_IDS = STRANDS.map((s) => s.id);

/* --------------------------------------------------------------------------
   The three shapes a prompt can take
   -------------------------------------------------------------------------- */

export const KINDS = [
  {
    id: 'claim',
    name: 'A claim to interrogate',
    shape:
      'A short, confident assertion of the kind a reasonable person might make. It should be neither obviously true nor obviously false, and it should have a hidden term or a buried assumption that the candidate has to find.',
  },
  {
    id: 'result',
    name: 'A counterintuitive result',
    shape:
      'A finding, mechanism or theorem stated plainly, whose conclusion runs against instinct. The question is "why does this happen?" or "should it change what we do?" — not "is this true?".',
  },
  {
    id: 'case',
    name: 'An ethical case',
    shape:
      'A concrete situation, told in two or three sentences, where two defensible principles pull in opposite directions. Never a trolley problem or any other case with a canonical published name; it should be a case the candidate meets fresh.',
  },
];

export const KIND_IDS = KINDS.map((k) => k.id);

/* --------------------------------------------------------------------------
   The five dimensions
   -------------------------------------------------------------------------- */

/**
 * What every answer is marked against, twice.
 *
 * These are fixed and small on purpose: five numbers per round is a shape you
 * can hold in your head between sittings, and it is the same five every time,
 * so the trend means something.
 */
export const DIMENSIONS = [
  {
    id: 'structure',
    name: 'Structure',
    asks: 'Did you define the terms before using them, and did the answer have a shape you could hear?',
    fails:
      'Arguing about a word neither of you has fixed. Three unrelated observations in a row. A conclusion that arrives without having been built.',
  },
  {
    id: 'reasoning',
    name: 'Reasoning',
    asks: 'Does the argument hold, and if not, exactly where does it break?',
    fails: 'A step that needs a premise you never supplied. An inference that runs the wrong way. A case treated as a rule.',
  },
  {
    id: 'evidence',
    name: 'Evidence',
    asks: 'Concrete, or hand-waving?',
    fails: '"Studies show." "Historically." A named example that turns out to be doing no work. An intuition offered as a fact.',
  },
  {
    id: 'responsiveness',
    name: 'Responsiveness',
    asks: 'Did you answer the question that was asked?',
    fails: 'Answering the adjacent question you had prepared for. Restating the prompt at length. Missing that the question had two parts.',
  },
  {
    id: 'delivery',
    name: 'Delivery',
    asks: 'Pace, filler, hedging, commitment.',
    fails:
      '"I think maybe possibly." Trailing off rather than landing. Speaking so fast the argument cannot be followed, or so slowly that ninety seconds buys one claim.',
  },
];

export const DIMENSION_IDS = DIMENSIONS.map((d) => d.id);

/* --------------------------------------------------------------------------
   Timing
   -------------------------------------------------------------------------- */

/** Fifteen minutes with the prompt and a blank page. */
export const PREP_SECONDS = 15 * 60;

/** The window you are asked to speak for. Under is as bad as over. */
export const ANSWER_MIN_SECONDS = 3 * 60;
export const ANSWER_MAX_SECONDS = 5 * 60;

/** How many topics to hold in reserve before writing more. */
export const TOPIC_FLOOR = 6;
export const TOPIC_BATCH = 9;

/* --------------------------------------------------------------------------
   Lookups
   -------------------------------------------------------------------------- */

const BY_STRAND = Object.fromEntries(STRANDS.map((s) => [s.id, s]));
export const getStrand = (id) => BY_STRAND[id] || null;

const BY_DIMENSION = Object.fromEntries(DIMENSIONS.map((d) => [d.id, d]));
export const getDimension = (id) => BY_DIMENSION[id] || null;

/** The dimensions block, for a prompt. */
export const DIMENSIONS_TEXT = DIMENSIONS.map(
  (d) => `- ${d.id} — ${d.name}. ${d.asks}\n  Typical failures: ${d.fails}`,
).join('\n');
