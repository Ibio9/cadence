/**
 * Objective proposals.
 *
 * A block with no objective is the most common way an hour is wasted: you sit
 * down, and the first ten minutes go on deciding. So Focus never shows an
 * empty objective — it shows three things you could plausibly mean, already
 * written, and you pick one.
 *
 * These are derived here on the client from the block's own title and project.
 * Nothing is fetched and no model is called: they are on screen the instant
 * Focus opens, which is the only reason they are useful at 21:00.
 *
 * The three are deliberately different in kind rather than three ways of
 * saying the same sentence, so picking one is a real decision:
 *
 *   1. FINISH   close something and have it behind you
 *   2. REPAIR   go back at the part that is actually weak
 *   3. ADVANCE  push past where you got to last time
 *
 * WHY NO PROPOSAL NAMES THE TOPIC
 *
 * An earlier version wrote the block's title into each sentence. It read as
 * mail merge the moment a title was a phrase rather than a bare noun:
 *
 *     "Write one paragraph of the Market failure essay essay and stop."
 *     "Do one Section A under time section under the clock and mark it."
 *
 * The templates supplied a noun — chapter, essay, section, position — and the
 * title supplied another, so the two collided. Patching the grammar was the
 * obvious fix and the wrong one: on Focus the objective sits directly beneath
 * the block's title, set large. Naming the topic inside the objective was
 * repeating, in small type, the words immediately above it.
 *
 * So the topic is gone from the strings entirely. Each proposal says only what
 * you will do with the hour, and reads correctly under any title.
 */

/**
 * Which family of work this is.
 *
 * Format first, because it decides what a good objective looks like more than
 * the subject does: a past paper wants "under time and mark it" whether it is
 * maths or economics. Then the project, which is the fact. The rest of the
 * title is consulted only when neither has settled it.
 */
function kindOf(block, project) {
  const id = project?.id || block?.projectId || '';
  const title = (block?.title || '').toLowerCase();

  if (/\b(paper|past|mock|exam|test)\b/.test(title)) return 'paper';

  const byProject = {
    train: 'training',
    tara: 'tara',
    fm: 'problems',
    maths: 'problems',
    phil: 'reading',
    econ: 'econ',
    oxprep: 'oxprep',
  };
  if (byProject[id]) return byProject[id];

  if (/\b(bjj|mma|muay|mt |pads|bag|spar|gym|lift|run|condition)\b/.test(title)) return 'training';
  if (/\btara\b/.test(title)) return 'tara';
  if (/\b(essay|read|reading)\b/.test(title)) return 'reading';
  return 'general';
}

const SHAPES = {
  training: [
    'Drill one position until it is automatic.',
    'Go at the thing that beat you last session.',
    'Train the full hour and write down one thing that worked.',
  ],
  tara: [
    'Sit one section under the clock, then mark it.',
    'Work out why you got the last set wrong, question by question.',
    'Read one unseen passage and write its argument in three lines.',
  ],
  paper: [
    'Finish it under time and mark it.',
    'Redo every question you got wrong.',
    'Do the next section without notes.',
  ],
  problems: [
    'Finish one exercise and mark it.',
    'Redo the questions you got wrong last time.',
    'Work at it until you can do an unseen question cold.',
  ],
  reading: [
    'Read one chapter and write the argument in your own words.',
    'Go back over the passage you skimmed and take it apart.',
    'Write one paragraph and stop.',
  ],
  econ: [
    'Finish one question and mark it against the scheme.',
    'Fix the diagram you keep drawing wrong.',
    'Write one evaluation paragraph and stop.',
  ],
  oxprep: [
    'Finish one piece and put it away done.',
    'Go back at the part you keep avoiding.',
    'Take it one step further than last time.',
  ],
  general: [
    'Finish one piece and stop.',
    'Fix the part you keep skipping.',
    'Take it one step further than last time.',
  ],
};

/**
 * Three objectives for this block. Always exactly three, always concrete,
 * always available offline.
 */
export function proposeObjectives(block, project) {
  return SHAPES[kindOf(block, project)];
}

export default proposeObjectives;
