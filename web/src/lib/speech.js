'use client';

/**
 * Live transcription, in the browser, for nothing.
 *
 * The Web Speech API runs recognition on the device (or through the browser
 * vendor's own service — either way not through us), which means the
 * transcription for an interview session costs exactly zero and no audio ever
 * touches the Cadence server. The only paid part of a sitting is the critique.
 *
 * It is Chrome, Edge and Safari only. Firefox has never shipped it. Rather than
 * pretend otherwise, `supported` is exported and the screen says plainly what
 * is missing and what to do — and the transcript pane stays editable in every
 * browser, so a session is always completable by typing.
 *
 * Two things this has to get right that a naive wrapper does not:
 *
 *   1. Recognition stops itself. Chrome ends a session after a stretch of
 *      silence whatever `continuous` says, so a four-minute answer with a
 *      thinking pause in it loses everything after the pause unless it is
 *      restarted. The restart is invisible and the transcript accumulates
 *      across it.
 *   2. Interim results are not the transcript. They are rewritten as the engine
 *      changes its mind, so only finalised segments are appended; the interim
 *      tail is kept separate for display and replaced each time.
 */

export function speechSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start listening. Returns a handle with `stop()`.
 *
 * `onText(finalTail, interim)` is called with each newly finalised chunk and
 * the current interim tail. The caller owns the accumulated transcript, so a
 * restart mid-answer cannot lose what came before it.
 */
export function listen({ onText, onError, lang = 'en-GB' }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    onError?.('This browser cannot transcribe speech. Use Chrome, Edge or Safari, or type the transcript.');
    return { stop() {} };
  }

  let stopped = false;
  let recognition = null;

  const start = () => {
    recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let settled = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) settled += result[0].transcript;
        else interim += result[0].transcript;
      }
      onText?.(settled, interim);
    };

    recognition.onerror = (event) => {
      // `no-speech` and `aborted` are ordinary in a four-minute answer with
      // pauses in it, and surfacing them would train you to ignore the error
      // line. Only real failures are reported.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopped = true;
        onError?.('The microphone is blocked. Allow it in the address bar, then start again.');
        return;
      }
      onError?.(`Transcription stopped: ${event.error}. Your recording is still running.`);
    };

    // The restart. Chrome ends the session on silence whatever `continuous`
    // says, so an answer with a thinking pause in it would otherwise stop
    // transcribing at the pause and never resume.
    recognition.onend = () => {
      if (stopped) return;
      try {
        recognition.start();
      } catch {
        // A restart can land while the previous session is still closing.
        // Try once more on the next tick rather than giving up on the answer.
        setTimeout(() => {
          if (!stopped) {
            try {
              recognition.start();
            } catch {
              onError?.('Transcription stopped and could not restart. Type the rest, or record again.');
            }
          }
        }, 250);
      }
    };

    recognition.start();
  };

  try {
    start();
  } catch (e) {
    onError?.(`Transcription would not start: ${e.message}`);
  }

  return {
    stop() {
      stopped = true;
      try {
        recognition?.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}
