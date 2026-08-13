/**
 * Marking an interview answer.
 *
 * Two things make this worth doing rather than comforting:
 *
 *   1. The register. The prompt below forbids the praise sandwich explicitly,
 *      and forbids it by naming the failure mode rather than asking for
 *      "honest feedback" — every model will tell you it is being honest while
 *      opening with what you did well. A critique that reads nicely and does
 *      not change what you do next is worse than none, because it costs the
 *      same fifteen minutes and buys the belief that you are ready.
 *
 *   2. Web search, on. Every named thinker, case, paper or result in the model
 *      answer and the reading list is confirmed against the live web before it
 *      is written down. Walking into a real interview confident about a
 *      misattributed argument is worse than not knowing it at all — the tutor
 *      finds out in one question, and now you are wrong *and* were sure.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ANSWER_MAX_SECONDS,
  ANSWER_MIN_SECONDS,
  DIMENSIONS_TEXT,
  DIMENSION_IDS,
  getStrand,
} from './strands.js';

const MODEL = 'claude-opus-5';

let client;
function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set on the server, so nothing can be marked.');
  }
  client ??= new Anthropic();
  return client;
}

/* --------------------------------------------------------------------------
   The contract
   -------------------------------------------------------------------------- */

const scoreProps = Object.fromEntries(
  DIMENSION_IDS.map((id) => [
    id,
    {
      type: 'object',
      properties: {
        score: { type: 'integer', description: '0 to 10. A borderline Oxford offer is around 7.' },
        verdict: { type: 'string', description: 'One or two sentences. What this score is for, specifically.' },
      },
      required: ['score', 'verdict'],
      additionalProperties: false,
    },
  ]),
);

const QUOTE = {
  type: 'object',
  properties: {
    quote: { type: 'string', description: 'Verbatim from the transcript. Never paraphrased.' },
    problem: { type: 'string', description: 'What went wrong at exactly this point.' },
  },
  required: ['quote', 'problem'],
  additionalProperties: false,
};

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'object',
      properties: scoreProps,
      required: DIMENSION_IDS,
      additionalProperties: false,
    },
    /** The headline. One paragraph, no preamble, no softening. */
    read: { type: 'string' },
    collapses: {
      type: 'array',
      description: 'Every point where the argument stopped holding, quoted. Empty only if there genuinely were none.',
      items: QUOTE,
    },
    hedges: {
      type: 'array',
      description: 'Every hedge, filler run and abandoned sentence, quoted verbatim.',
      items: QUOTE,
    },
    prepared: {
      type: 'object',
      description: 'What a good fifteen minutes on this prompt looks like.',
      properties: {
        approach: { type: 'string', description: 'How to spend the fifteen minutes, in order, as prose.' },
        searches: {
          type: 'array',
          description: 'What to look up, in the order to look it up, and what to look for in the result.',
          items: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              looking_for: { type: 'string' },
            },
            required: ['query', 'looking_for'],
            additionalProperties: false,
          },
        },
        framings: {
          type: 'array',
          description: 'The framings to reach for on this prompt, and when each one is the right one.',
          items: {
            type: 'object',
            properties: {
              framing: { type: 'string' },
              when: { type: 'string' },
            },
            required: ['framing', 'when'],
            additionalProperties: false,
          },
        },
      },
      required: ['approach', 'searches', 'framings'],
      additionalProperties: false,
    },
    could_have_said: {
      type: 'object',
      description: 'The moves that were available and were not made.',
      properties: {
        distinction: { type: 'string', description: 'The distinction that would have sharpened the answer.' },
        counterexample: { type: 'string', description: 'The counterexample that was sitting there.' },
        expected: {
          type: 'string',
          description:
            'The thinker, paper or case a tutor would expect to be reached for here, and what specifically about it applies. Confirmed by search.',
        },
        steelman: {
          type: 'string',
          description: 'The strongest form of the position that was dismissed, stated properly.',
        },
      },
      required: ['distinction', 'counterexample', 'expected', 'steelman'],
      additionalProperties: false,
    },
    model_answer: {
      type: 'string',
      description:
        'A full answer, in prose, at the length the candidate was asked to speak for. Continuous paragraphs — never bullets, never headings.',
    },
    divergences: {
      type: 'array',
      description: 'Two or three moments where the answer took a weaker path than it could have.',
      items: {
        type: 'object',
        properties: {
          mine: { type: 'string', description: 'Verbatim from the transcript.' },
          alternative: { type: 'string', description: 'What the model answer does at the same point.' },
          note: { type: 'string', description: 'Why the second is stronger.' },
        },
        required: ['mine', 'alternative', 'note'],
        additionalProperties: false,
      },
    },
    sources: {
      type: 'array',
      description:
        'Every work, thinker or result named anywhere above. Each one must have been confirmed by search in this session — no citation from memory.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          author: { type: 'string' },
          url: { type: 'string' },
          why: { type: 'string', description: 'What it is for, in one line.' },
        },
        required: ['title', 'author', 'url', 'why'],
        additionalProperties: false,
      },
    },
    follow_up: {
      type: 'string',
      description:
        'The tutor\'s push-back, aimed at exactly what the candidate said. Empty string on the second round.',
    },
    biggest_weakness: { type: 'string', description: 'The single biggest weakness. One sentence.' },
    next_time: { type: 'string', description: 'One specific thing to do differently. Never generic advice.' },
  },
  required: [
    'scores',
    'read',
    'collapses',
    'hedges',
    'prepared',
    'could_have_said',
    'model_answer',
    'divergences',
    'sources',
    'follow_up',
    'biggest_weakness',
    'next_time',
  ],
  additionalProperties: false,
};

/* --------------------------------------------------------------------------
   The register
   -------------------------------------------------------------------------- */

const REGISTER = `HOW TO WRITE THIS.

You are an Oxford PPE tutor marking an answer that was spoken out loud, once,
under time pressure. Not a coach. Not a supervisor writing a report the
candidate's parents will read.

- No praise sandwich. Do not open with what went well. Do not close with
  encouragement. If something was genuinely good, say so in the sentence where
  it is relevant and move on.
- No softening. "This could perhaps have been developed a little further" is
  not marking, it is politeness. Write "this never became an argument".
- Quote. Every claim about the answer is anchored to the candidate's own words,
  verbatim, including the ums and the false starts. If you cannot quote it, do
  not assert it.
- Where an argument collapsed, name the exact sentence it collapsed at and say
  what was missing at that step. "The reasoning was weak" is not a finding.
- Where the candidate hedged, quote the hedge. "I think maybe it could be
  argued that possibly" is a delivery failure and it is quotable.
- Be accurate about what is actually wrong. Inventing a flaw to look rigorous
  is the same failure as flattering, in the opposite direction, and it is worse
  because it sends the candidate to fix something that was fine.

Scores are 0 to 10, and 7 is a borderline offer. Most first attempts sit
between 4 and 6. Do not cluster everything at 6 to avoid a judgement — if
delivery was a 3, it was a 3, and the trend across sittings is only worth
anything if the numbers move.`;

const SOURCE_RULE = `NAMED WORK MUST BE REAL, AND YOU MUST HAVE JUST CHECKED IT.

You have web search. Use it before you name anything.

Every thinker, paper, book, case, statute or empirical result you mention —
in the model answer, in "what you could have said", in the reading — must be
searched for in this session and confirmed to exist, to say what you claim it
says, and to be by the person you attribute it to. Then list it under
"sources" with a real URL.

Do not cite from memory. Not once, not for the famous ones, not for the one
you are sure about. A candidate who walks into an interview confident about a
misattributed argument is worse off than one who never heard of it: the tutor
finds out in a single question, and the candidate is now both wrong and was
certain. That is the specific harm this rule exists to prevent.

If you cannot confirm something, do not name it. An unnamed but correctly
described argument is worth more than a named one you have half-remembered.`;

/* --------------------------------------------------------------------------
   Prompts
   -------------------------------------------------------------------------- */

function timing(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const said = `${m}m ${String(s).padStart(2, '0')}s`;
  if (seconds < ANSWER_MIN_SECONDS) {
    return `${said} — under the three-minute floor. Say so, and say what the missing time should have contained.`;
  }
  if (seconds > ANSWER_MAX_SECONDS) {
    return `${said} — over the five-minute ceiling. Say so, and name what should have been cut.`;
  }
  return `${said} — inside the window.`;
}

function buildFirstRound({ strand, prompt, context, notes, transcript, seconds }) {
  const s = getStrand(strand);
  return `${REGISTER}

${SOURCE_RULE}

THE PROMPT THE CANDIDATE WAS GIVEN
Strand: ${s?.name || strand}
${context ? `Context: ${context}\n` : ''}"${prompt}"

What a tutor is watching for in this strand: ${s?.watching || ''}

THE FIFTEEN MINUTES OF PREP NOTES
${notes?.trim() ? notes.trim() : '(nothing was written down)'}

THE ANSWER, AS SPOKEN
Length: ${timing(seconds)}
Transcript, verbatim and unedited:
---
${transcript.trim()}
---

Note on the transcript: it comes from live speech recognition, so punctuation
is approximate and some words may be misheard. Mark the argument, not the
transcription. Where a hedge or a filler run is clearly real, quote it — those
are the parts speech recognition gets right.

MARK IT ON FIVE DIMENSIONS:
${DIMENSIONS_TEXT}

THEN WRITE THE FOUR THINGS THAT ARE ACTUALLY WORTH HAVING:

1. HOW TO HAVE PREPARED. What a good fifteen minutes on THIS prompt looks like:
   what to search, in what order, what to look for in each result, and which
   framings to reach for and when. Specific to this prompt — not a method.

2. WHAT COULD HAVE BEEN SAID. The distinction that would have sharpened it. The
   counterexample sitting there unused. The thinker or case a tutor would
   expect. The steelman of whatever position was dismissed.

3. A MODEL ANSWER. Full, in continuous prose, at the length the candidate was
   asked to speak for — that is roughly ${Math.round((ANSWER_MIN_SECONDS + ANSWER_MAX_SECONDS) / 2 / 60 * 140)} words at speaking pace. Never
   bullets, never headings. It should be sayable out loud, in one go, by a
   nervous seventeen-year-old. Write it to be read aloud and compared.

4. WHERE THIS ANSWER DIVERGED. Two or three moments where it took a weaker
   path, quoting the candidate against what the model answer does instead.

FINALLY, THE FOLLOW-UP.
Write the question a tutor would ask next. It must push back on what this
candidate ACTUALLY said — not a generic second question about the topic. Find
the weakest load-bearing claim in the transcript and press on it. It should be
answerable, and it should be uncomfortable.`;
}

function buildSecondRound({ strand, prompt, first, question, transcript, seconds }) {
  return `${REGISTER}

${SOURCE_RULE}

This is the SECOND round, and it is where the real assessment is. The first
answer was prepared for fifteen minutes; this one was not. How someone handles
push-back on their own claim is most of what an interview is measuring.

THE ORIGINAL PROMPT
"${prompt}"

WHAT THE CANDIDATE SAID FIRST
---
${first.transcript.trim()}
---

THE PUSH-BACK THEY WERE GIVEN
"${question}"

THEIR ANSWER TO IT
Length: ${timing(seconds)}
---
${transcript.trim()}
---

Mark this answer on the same five dimensions:
${DIMENSIONS_TEXT}

Judge it as a response under pressure, and be specific about which of these
happened:
- Did they defend the original claim, concede it, or quietly abandon it while
  appearing to defend it? The third is the most common and the most damaging;
  if it happened, quote the sentence where the position moved.
- Did they take the push-back seriously, or restate the first answer louder?
- Did they find the distinction that would have saved them?
- If they conceded, did they concede cleanly and rebuild, or collapse?

Then write, for this round: how to have prepared for this specific push-back,
what could have been said, a model answer to the follow-up in continuous prose
at the same length, and where their answer diverged.

Leave "follow_up" as an empty string — there is no third round.

Finally, across BOTH rounds: the single biggest weakness, and one specific
thing to do differently next time. "Be more confident" is not a finding.
Something like "define the term in your first sentence, before you use it in
your second" is.`;
}

/* --------------------------------------------------------------------------
   The call
   -------------------------------------------------------------------------- */

/** Every named work, or nothing. Pull the last JSON object out of loose text. */
function parseLoose(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

/**
 * One critique. Runs the model with web search on and a JSON schema out.
 *
 * The `pause_turn` loop is not optional: a server-tool turn that runs long
 * stops with that reason and has to be re-sent to continue. Without the loop a
 * critique that did five searches comes back truncated and looks like a bad
 * mark rather than an unfinished one.
 */
export async function critique(input) {
  const prompt = input.round === 2 ? buildSecondRound(input) : buildFirstRound(input);

  const messages = [{ role: 'user', content: prompt }];
  let response;

  for (let turn = 0; turn < 6; turn += 1) {
    response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 24000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: { type: 'json_schema', schema: CRITIQUE_SCHEMA } },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
      messages,
    });

    if (response.stop_reason === 'refusal') throw new Error('The model declined to mark this answer.');
    if (response.stop_reason !== 'pause_turn') break;

    // The server ran out of tool iterations mid-turn. Hand the partial turn
    // back and it picks up where it stopped — no extra user message.
    messages.push({ role: 'assistant', content: response.content });
  }

  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  if (!text.trim()) throw new Error('The marking came back empty. Try again.');

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // The schema should make this impossible, but a truncated or tool-heavy
    // turn can still hand back prose around the object. Recover rather than
    // throwing away a transcript that cannot be re-recorded.
    parsed = parseLoose(text);
  }

  return shape(parsed);
}

/** Normalise, clamp, and drop anything malformed rather than storing it. */
function shape(c) {
  const scores = {};
  for (const id of DIMENSION_IDS) {
    const raw = c.scores?.[id];
    scores[id] = {
      score: Math.max(0, Math.min(10, Math.round(Number(raw?.score) || 0))),
      verdict: String(raw?.verdict || '').trim(),
    };
  }

  const quotes = (list) =>
    (Array.isArray(list) ? list : [])
      .filter((q) => q?.quote?.trim() && q?.problem?.trim())
      .map((q) => ({ quote: q.quote.trim(), problem: q.problem.trim() }));

  return {
    /** Flat integers, for the trend. */
    flat: Object.fromEntries(DIMENSION_IDS.map((id) => [id, scores[id].score])),
    critique: {
      scores,
      read: String(c.read || '').trim(),
      collapses: quotes(c.collapses),
      hedges: quotes(c.hedges),
      prepared: {
        approach: String(c.prepared?.approach || '').trim(),
        searches: (c.prepared?.searches || [])
          .filter((s) => s?.query?.trim())
          .map((s) => ({ query: s.query.trim(), looking_for: String(s.looking_for || '').trim() })),
        framings: (c.prepared?.framings || [])
          .filter((f) => f?.framing?.trim())
          .map((f) => ({ framing: f.framing.trim(), when: String(f.when || '').trim() })),
      },
      couldHaveSaid: {
        distinction: String(c.could_have_said?.distinction || '').trim(),
        counterexample: String(c.could_have_said?.counterexample || '').trim(),
        expected: String(c.could_have_said?.expected || '').trim(),
        steelman: String(c.could_have_said?.steelman || '').trim(),
      },
      divergences: (c.divergences || [])
        .filter((d) => d?.mine?.trim() && d?.alternative?.trim())
        .map((d) => ({
          mine: d.mine.trim(),
          alternative: d.alternative.trim(),
          note: String(d.note || '').trim(),
        })),
    },
    modelAnswer: String(c.model_answer || '').trim(),
    // A source without a URL is a citation from memory wearing a source's
    // clothes, which is the one thing this call exists to prevent.
    sources: (c.sources || [])
      .filter((s) => s?.title?.trim() && s?.url?.trim())
      .map((s) => ({
        title: s.title.trim(),
        author: String(s.author || '').trim(),
        url: s.url.trim(),
        why: String(s.why || '').trim(),
      })),
    followUp: String(c.follow_up || '').trim(),
    biggestWeakness: String(c.biggest_weakness || '').trim(),
    nextTime: String(c.next_time || '').trim(),
  };
}
