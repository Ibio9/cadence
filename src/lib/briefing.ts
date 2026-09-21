/**
 * The two things JARVIS is asked for without being spoken to.
 *
 * Both are written as if he had said them, because that is what they are: the
 * interface pressing the button he would otherwise have to press himself. They
 * stay deliberately thin. What a briefing actually contains, the order of it,
 * and what to do when the mail is unreachable all live in bridge/personal.mjs
 * next to the timetable they depend on, so that changing the shape of his
 * morning does not mean editing the front end.
 *
 * Phrased as requests rather than as commands so they read correctly in the
 * transcript, which shows them as his turn.
 */

/** Sent once, the moment he finishes powering up. */
export const OPENING_BRIEFING =
  'Give me my opening briefing: my unread mail summarised, my day planned ' +
  'around school, and anything due in the next fortnight. Then ' +
  'ask me what I want to do with the free blocks.'

/** Sent when the right hand makes an M, and from the mail button. */
export const REREAD_MAIL =
  'Re-read my mail and summarise what has come in since you last looked. ' +
  'Just the mail this time, not the whole briefing.'

/**
 * Sent by the right-hand 4 and by the NEWS tab.
 *
 * Longer and more demanding than the others on purpose. The rest of these are
 * status checks, where the persona's two-sentence ceiling is exactly right;
 * this one is the opposite, a request to actually read several newsletters and
 * say what is in them. The instruction to put it on the display is what keeps
 * that from turning into a four-minute monologue.
 */
export const NEWS_BRIEFING =
  'Read my Economist and Bloomberg email and tell me what has actually ' +
  'happened. Those two senders only. Search first, then open at most the six ' +
  'most recent and work from those: do not try to read every unread one. If a ' +
  'message is very long, take what you need from the opening section rather ' +
  'than pulling the whole thing. ' +
  'I want the substance out of the bodies, not a list of subject lines: what ' +
  'happened, the numbers, and why it matters. Group it by theme rather than ' +
  'by email, put the whole thing on the display, and keep anything touching ' +
  'markets, the UK economy, or something I could use in an economics essay at ' +
  'the top. Say out loud only the single biggest story.'
