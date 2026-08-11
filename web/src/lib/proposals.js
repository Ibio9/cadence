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
 */

/** The block's own subject, with a repeated project name trimmed off the front. */
function topicOf(block, project) {
  const title = (block?.title || '').trim();
  const name = (project?.name || '').trim();
  if (!name) return title;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return title.replace(new RegExp(`^${escaped}\\s*[—–\\-:·]\\s*`, 'i'), '').trim() || title;
}

/**
 * Which family of work this is. Project id first, because it is the fact; the
 * title is only consulted when the project does not settle it.
 */
function kindOf(block, project) {
  const id = project?.id || block?.projectId || '';
  const title = (block?.title || '').toLowerCase();

  if (id === 'train' || /\b(bjj|mma|muay|mt |pads|bag|spar|gym|lift|run|condition)\b/.test(title)) return 'training';
  if (id === 'tara' || /\btara\b/.test(title)) return 'tara';
  if (/\b(paper|past|mock|exam|test)\b/.test(title)) return 'paper';
  if (id === 'fm' || id === 'maths') return 'problems';
  if (id === 'phil' || /\b(essay|read|reading)\b/.test(title)) return 'reading';
  if (id === 'econ') return 'econ';
  if (id === 'oxprep') return 'oxprep';
  return 'general';
}

const SHAPES = {
  training: (t) => [
    `Drill one ${t} position until it is automatic.`,
    `Go at the thing that beat you last session.`,
    `Train the full hour hard and write down one thing that worked.`,
  ],
  tara: (t) => [
    `Do one ${t} section under the clock and mark it.`,
    `Work out why you got the last set wrong, question by question.`,
    `Read one unseen passage and write its argument in three lines.`,
  ],
  paper: (t) => [
    `Finish ${t} under time and mark it.`,
    `Redo every question on ${t} you got wrong.`,
    `Do the next section of ${t} without notes.`,
  ],
  problems: (t) => [
    `Finish one ${t} exercise and mark it.`,
    `Redo the ${t} questions you got wrong last time.`,
    `Work at ${t} until you can do an unseen question cold.`,
  ],
  reading: (t) => [
    `Read one ${t} chapter and write the argument in your own words.`,
    `Go back over the ${t} passage you skimmed and take it apart.`,
    `Write one paragraph of the ${t} essay and stop.`,
  ],
  econ: (t) => [
    `Finish one ${t} question and mark it against the scheme.`,
    `Fix the ${t} diagram you keep drawing wrong.`,
    `Write one evaluation paragraph on ${t} and stop.`,
  ],
  oxprep: (t) => [
    `Finish one piece of ${t} and put it away done.`,
    `Go back at the part of ${t} you keep avoiding.`,
    `Take ${t} one step further than last time.`,
  ],
  general: (t) => [
    `Finish one piece of ${t} and stop.`,
    `Fix the part of ${t} you keep skipping.`,
    `Take ${t} one step further than last time.`,
  ],
};

/**
 * Three objectives for this block. Always exactly three, always concrete,
 * always available offline.
 */
export function proposeObjectives(block, project) {
  const topic = topicOf(block, project) || 'this';
  return SHAPES[kindOf(block, project)](topic);
}

export default proposeObjectives;
