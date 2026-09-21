'use client';

/**
 * One sitting, end to end.
 *
 * The stage lives on the server, so this screen reads `session.stage` and
 * renders it rather than tracking where it thinks it is. Refresh mid-prep,
 * close the laptop mid-critique, open it in a second tab — same place.
 *
 * There is no shell here, for the same reason Focus has none: for the fifteen
 * minutes you are looking at a prompt, nothing else on the screen is doing
 * anything useful.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import Icon from '../../components/Icon';
import { Badge, Button, ErrorState, Skeleton, Textarea, useToast } from '../../components/ui';
import { band, mmss, pace, useCountdown, useRecorder, useSitting } from '../../lib/interview';

const PREP_SECONDS = 15 * 60;
const WINDOW = { min: 180, max: 300 };
const STRAND_NAME = { philosophy: 'Philosophy', politics: 'Politics', economics: 'Economics' };
const DIMENSIONS = [
  { id: 'structure', name: 'Structure' },
  { id: 'reasoning', name: 'Reasoning' },
  { id: 'evidence', name: 'Evidence' },
  { id: 'responsiveness', name: 'Responsiveness' },
  { id: 'delivery', name: 'Delivery' },
];

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

function SittingShell({ children }) {
  return (
    <div className="cd-sitting">
      <div className="cd-focus__bar">
        <Link href="/interview" className="cd-backlink">
          <Icon name="arrowLeft" size={15} />
          <span>Interview</span>
        </Link>
      </div>
      {children}
    </div>
  );
}

function Prompt({ session, small }) {
  return (
    <header className={small ? 'cd-sitprompt cd-sitprompt--small' : 'cd-sitprompt'}>
      <p className="cd-eyebrow">{STRAND_NAME[session.strand] || session.strand}</p>
      {session.context ? <p className="cd-sitprompt__context">{session.context}</p> : null}
      <p className="cd-sitprompt__text">{session.prompt}</p>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Prep                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fifteen minutes and a blank page.
 *
 * The clock is the only lit thing on the screen and it does not panic: no red
 * at two minutes, no alarm at zero, and going over is allowed and counted. The
 * real fifteen minutes are silent, and getting used to feeling time pass
 * without being shouted at is part of what is being practised.
 */
function Prep({ session, onNotes, onReady }) {
  const [notes, setNotes] = useState(session.notes || '');
  const [running, setRunning] = useState(true);
  const { left, used, over } = useCountdown({
    total: PREP_SECONDS,
    running,
    already: session.prepSec || 0,
  });

  // The live figure, read at the moment of saving rather than closed over, so
  // a save that lands mid-tick records the clock as it actually is.
  const usedRef = useRef(used);
  usedRef.current = used;

  // Save on a pause in typing. The notes are read by the critique — what you
  // planned and what you said are different failures — so losing them to a
  // refresh would cost half the marking.
  useEffect(() => {
    const t = setTimeout(() => onNotes(notes, usedRef.current), 900);
    return () => clearTimeout(t);
  }, [notes, onNotes]);

  return (
    <>
      <Prompt session={session} />

      <div className="cd-prepbar">
        <p className={over ? 'cd-prepclock is-over' : 'cd-prepclock'}>
          <time dateTime={`PT${Math.abs(left)}S`}>
            {over ? '+' : ''}
            {mmss(Math.abs(left))}
          </time>
        </p>
        <div className="cd-prepbar__side">
          <p className="cd-prepbar__label">{over ? 'Over. Still fine — but land it.' : 'To think'}</p>
          <div className="flex items-center gap-2">
            <Button variant="tertiary" onClick={() => setRunning((r) => !r)}>
              {running ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="go" icon="mic" onClick={() => onReady(notes, usedRef.current)}>
              Ready to answer
            </Button>
          </div>
        </div>
      </div>

      <section className="cd-pane cd-pane--grow" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="cd-eyebrow">
          Notes
        </h2>
        <Textarea
          label="Prep notes"
          hideLabel
          rows={16}
          placeholder="Define the terms. Find the distinction. Pick the position you will actually defend, and the strongest thing that can be said against it."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="cd-savemark">The marking reads these. What you planned and what you said are different failures.</p>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Answering                                                               */
/* -------------------------------------------------------------------------- */

function Answering({ session, question, round, onSubmit, submitting }) {
  const rec = useRecorder();
  const [edited, setEdited] = useState(null);

  useEffect(() => {
    rec.arm();
    return rec.release;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = edited ?? rec.transcript;
  const spoken = text.trim().split(/\s+/).filter(Boolean).length;
  const inWindow = rec.seconds >= WINDOW.min && rec.seconds <= WINDOW.max;
  const wpm = pace(text, rec.seconds);

  return (
    <>
      <Prompt session={session} small />

      {round === 2 ? (
        <div className="cd-pushback">
          <p className="cd-eyebrow">The tutor pushes back</p>
          <p className="cd-pushback__text">{question}</p>
        </div>
      ) : null}

      <div className="cd-answer">
        <div className="cd-answer__camera">
          {/* Muted, or the room howls. Mirrored, because an un-mirrored
              self-view is disorienting to speak into. */}
          <video ref={rec.videoRef} className="cd-answer__video" muted playsInline />
          <div className={rec.state === 'recording' ? 'cd-reclamp is-live' : 'cd-reclamp'}>
            <span className="cd-reclamp__dot" />
            <span>{rec.state === 'recording' ? 'Recording' : 'Not recording'}</span>
          </div>
          <div className="cd-level" aria-hidden="true">
            <span className="cd-level__fill" style={{ '--level': `${Math.round(rec.level * 100)}%` }} />
          </div>
        </div>

        <div className="cd-answer__side">
          <p className={inWindow ? 'cd-answerclock is-in' : 'cd-answerclock'}>
            <time dateTime={`PT${rec.seconds}S`}>{mmss(rec.seconds)}</time>
          </p>
          <p className="cd-answerclock__window">
            {rec.seconds < WINDOW.min
              ? `Speak for at least ${mmss(WINDOW.min)}.`
              : rec.seconds > WINDOW.max
                ? `Past ${mmss(WINDOW.max)}. Land it.`
                : `Inside the window. ${mmss(WINDOW.max - rec.seconds)} left.`}
          </p>
          {wpm ? (
            <p className="cd-answerclock__pace">
              {wpm} words a minute{wpm > 175 ? ' — fast' : wpm < 110 ? ' — slow' : ''}
            </p>
          ) : null}

          <div className="cd-answer__actions">
            {rec.state === 'ready' ? (
              <Button variant="go" icon="record" size="lg" onClick={rec.start}>
                Start answering
              </Button>
            ) : rec.state === 'recording' ? (
              <Button variant="secondary" icon="stop" size="lg" onClick={rec.stop}>
                Done
              </Button>
            ) : rec.state === 'stopped' ? (
              <Button
                variant="go"
                icon="arrowRight"
                size="lg"
                loading={submitting}
                disabled={spoken < 40}
                onClick={() => onSubmit(text, rec.seconds)}
              >
                Mark it
              </Button>
            ) : (
              <Button variant="secondary" icon="camera" onClick={rec.arm}>
                Turn the camera on
              </Button>
            )}
          </div>

          {!rec.speechSupported ? (
            <p className="cd-answer__note">
              This browser will not transcribe speech. Chrome, Edge and Safari will. Record anyway and type what you
              said into the box below — the marking works from the words either way.
            </p>
          ) : null}
          {rec.error ? (
            <p className="cd-answer__problem">
              <Icon name="alertCircle" size={13} />
              {rec.error}
            </p>
          ) : null}
        </div>
      </div>

      <section className="cd-pane" aria-labelledby="transcript-heading">
        <h2 id="transcript-heading" className="cd-eyebrow">
          Transcript
        </h2>
        {rec.state === 'stopped' ? (
          <>
            <Textarea
              label="Transcript"
              hideLabel
              rows={10}
              value={text}
              onChange={(e) => setEdited(e.target.value)}
              placeholder="What you said."
            />
            <p className="cd-savemark">
              {spoken} words. Fix anything the recogniser misheard — but do not improve the argument, or the marking
              is of something you did not say.
            </p>
          </>
        ) : (
          <p className="cd-livetranscript">
            {rec.transcript || <span className="cd-livetranscript__idle">Nothing yet.</span>}
            {rec.interim ? <span className="cd-livetranscript__interim"> {rec.interim}</span> : null}
          </p>
        )}
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Marking                                                                 */
/* -------------------------------------------------------------------------- */

function Marking() {
  return (
    <div className="cd-marking">
      <Icon name="sparkle" size={22} className="cd-marking__icon cd-breathes" />
      <p className="cd-marking__title">Marking it</p>
      <p>
        Reading the transcript against the prompt, checking every work it is about to name against the live web, and
        writing the answer you could have given. A minute or two. Leave the tab open.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. The critique                                                            */
/* -------------------------------------------------------------------------- */

function Scores({ scores, critique }) {
  return (
    <ul className="cd-dimlist list-none">
      {DIMENSIONS.map((d) => {
        const n = scores?.[d.id];
        const b = band(n);
        return (
          <li key={d.id} className="cd-dim">
            <span className="cd-dim__head">
              <span className="cd-dim__name">{d.name}</span>
              <span className="cd-dim__score">
                {n ?? '—'}
                <span className="cd-dim__of">/10</span>
              </span>
              <Badge tone={b.tone}>{b.label}</Badge>
            </span>
            <span className="cd-dim__track" aria-hidden="true">
              <span className={`cd-dim__fill is-${b.tone}`} style={{ width: `${((n ?? 0) / 10) * 100}%` }} />
            </span>
            <span className="cd-dim__verdict">{critique?.scores?.[d.id]?.verdict}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Quotes({ title, lead, items, tone }) {
  if (!items?.length) return null;
  return (
    <section className="cd-section">
      <h3 className="cd-section__title">{title}</h3>
      {lead ? <p className="cd-section__lead">{lead}</p> : null}
      <ul className="cd-quotes list-none">
        {items.map((q, i) => (
          <li key={i} className={`cd-quote is-${tone}`}>
            <p className="cd-quote__said">“{q.quote}”</p>
            <p className="cd-quote__problem">{q.problem}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoundCritique({ round, open }) {
  const c = round.critique || {};
  const prep = c.prepared || {};
  const could = c.couldHaveSaid || {};

  return (
    <details className="cd-round" open={open}>
      <summary className="cd-round__summary">
        <span className="cd-round__n">Round {round.n}</span>
        <span className="cd-round__q">{round.n === 1 ? 'The opening question' : 'The push-back'}</span>
        <span className="cd-round__time">{mmss(round.seconds)}</span>
        <Icon name="chevronDown" size={16} className="cd-round__chev" />
      </summary>

      <div className="cd-round__body">
        {round.n === 2 ? <p className="cd-round__asked">“{round.question}”</p> : null}

        <p className="cd-read">{c.read}</p>

        <Scores scores={round.scores} critique={c} />

        <Quotes
          title="Where it gave way"
          lead="The exact sentence, and what was missing at that step."
          items={c.collapses}
          tone="alarm"
        />
        <Quotes
          title="Where you hedged"
          lead="Quoted as spoken. These are the parts speech recognition gets right."
          items={c.hedges}
          tone="warn"
        />

        {prep.approach ? (
          <section className="cd-section">
            <h3 className="cd-section__title">How to have prepared</h3>
            <p className="cd-prose">{prep.approach}</p>
            {prep.searches?.length ? (
              <ol className="cd-searchlist">
                {prep.searches.map((s, i) => (
                  <li key={i}>
                    <span className="cd-searchlist__q">{s.query}</span>
                    <span className="cd-searchlist__for">{s.looking_for}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            {prep.framings?.length ? (
              <ul className="cd-framings list-none">
                {prep.framings.map((f, i) => (
                  <li key={i}>
                    <span className="cd-framings__name">{f.framing}</span>
                    <span className="cd-framings__when">{f.when}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {could.distinction ? (
          <section className="cd-section">
            <h3 className="cd-section__title">What you could have said</h3>
            <dl className="cd-moves">
              <dt>The distinction</dt>
              <dd>{could.distinction}</dd>
              <dt>The counterexample</dt>
              <dd>{could.counterexample}</dd>
              <dt>What a tutor would expect</dt>
              <dd>{could.expected}</dd>
              <dt>The steelman you skipped</dt>
              <dd>{could.steelman}</dd>
            </dl>
          </section>
        ) : null}

        {round.modelAnswer ? (
          <section className="cd-section">
            <h3 className="cd-section__title">A model answer</h3>
            <p className="cd-section__lead">
              At the length you were asked to speak for. Read it out loud once — the point is to hear the difference,
              not to memorise it.
            </p>
            <div className="cd-modelanswer">
              {round.modelAnswer.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ) : null}

        {c.divergences?.length ? (
          <section className="cd-section">
            <h3 className="cd-section__title">Where yours diverged</h3>
            <ul className="cd-divergences list-none">
              {c.divergences.map((d, i) => (
                <li key={i}>
                  <p className="cd-diverge__mine">
                    <span className="cd-eyebrow">You said</span>
                    “{d.mine}”
                  </p>
                  <p className="cd-diverge__alt">
                    <span className="cd-eyebrow">Instead</span>
                    {d.alternative}
                  </p>
                  <p className="cd-diverge__note">{d.note}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {round.sources?.length ? (
          <section className="cd-section">
            <h3 className="cd-section__title">Checked, not remembered</h3>
            <p className="cd-section__lead">
              Every work named above, looked up while this was being written. Follow one before you use it.
            </p>
            <ul className="cd-sources list-none">
              {round.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noreferrer" className="cd-sources__title">
                    {s.title}
                  </a>
                  {s.author ? <span className="cd-sources__author">{s.author}</span> : null}
                  <span className="cd-sources__why">{s.why}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <details className="cd-said">
          <summary>What you actually said</summary>
          <p className="cd-said__text">{round.transcript}</p>
        </details>
      </div>
    </details>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function SittingScreen({ id }) {
  const { session, setSession, status, error, reload } = useSitting(id);
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const saveNotes = useCallback(
    async (notes, prepSec) => {
      try {
        await api.interview.save(id, { notes, prepSec });
      } catch {
        // Autosave. The next keystroke tries again, and the notes are still on
        // screen — an error toast per pause in typing would be worse than the
        // risk it warns about.
      }
    },
    [id],
  );

  const toStage = async (stage, notes, prepSec) => {
    try {
      setSession(await api.interview.save(id, { stage, ...(notes != null ? { notes, prepSec } : {}) }));
    } catch (e) {
      toast({ tone: 'danger', title: 'That did not save', description: e.message });
    }
  };

  const submit = async (transcript, seconds) => {
    setSubmitting(true);
    try {
      setSession(await api.interview.mark(id, { transcript, seconds }));
    } catch (e) {
      toast({ tone: 'danger', title: 'The marking did not come back', description: e.message });
    }
    setSubmitting(false);
  };

  if (status === 'loading' && !session) {
    return (
      <SittingShell>
        <Skeleton width="min(30rem, 90%)" height="3rem" rounded="pill" />
        <Skeleton height="16rem" rounded="card" />
      </SittingShell>
    );
  }

  if (status === 'missing') {
    return (
      <SittingShell>
        <ErrorState
          title="That sitting is gone"
          body="It was deleted, or this link points somewhere that has moved. Start a new one."
          action={{ label: 'Back to Interview', href: '/interview' }}
        />
      </SittingShell>
    );
  }

  if (status === 'error' && !session) {
    return (
      <SittingShell>
        <ErrorState
          title="This sitting did not load"
          body="The server did not answer. Your transcript and marking are on it. Check your connection and try again."
          detail={error}
          onRetry={reload}
        />
      </SittingShell>
    );
  }

  const rounds = session.rounds || [];
  const first = rounds.find((r) => r.n === 1);
  const second = rounds.find((r) => r.n === 2);
  const followUp = first?.critique?.followUp;

  return (
    <SittingShell>
      {submitting || session.stage === 'marking' ? (
        <Marking />
      ) : session.stage === 'prep' ? (
        <Prep
          session={session}
          onNotes={saveNotes}
          onReady={(notes, prepSec) => toStage('answering', notes, prepSec)}
        />
      ) : session.stage === 'answering' ? (
        <Answering session={session} round={1} question={session.prompt} onSubmit={submit} submitting={submitting} />
      ) : session.stage === 'followup' ? (
        <Answering session={session} round={2} question={followUp} onSubmit={submit} submitting={submitting} />
      ) : (
        <>
          <Prompt session={session} small />

          {session.stage === 'done' ? (
            <section className="cd-verdict">
              <p className="cd-eyebrow">The verdict</p>
              <p className="cd-verdict__weak">{session.weakness}</p>
              <p className="cd-verdict__next">
                <span className="cd-eyebrow">Next time</span>
                {session.nextTime}
              </p>
            </section>
          ) : null}

          {first ? <RoundCritique round={first} open={!second} /> : null}

          {session.stage === 'round1' && followUp ? (
            <section className="cd-nextround">
              <p className="cd-eyebrow">The tutor pushes back</p>
              <p className="cd-nextround__q">{followUp}</p>
              <p className="cd-nextround__why">
                This is aimed at what you actually said, not at the topic. The second round is where the real
                assessment is — it is the answer you have not prepared.
              </p>
              <Button variant="go" icon="mic" size="lg" onClick={() => toStage('followup')}>
                Answer it
              </Button>
            </section>
          ) : null}

          {second ? <RoundCritique round={second} open /> : null}
        </>
      )}
    </SittingShell>
  );
}

export default SittingScreen;
