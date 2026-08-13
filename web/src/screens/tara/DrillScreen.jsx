'use client';

/**
 * The drill.
 *
 * One route, five modes, because they differ only in three things: whether the
 * clock is running, whether the explanation appears now or at the end, and
 * whether you may go back.
 *
 *   practice  untimed, explanation the moment you answer
 *   timed     the real per-question budget, explanations at the end
 *   mock      22 questions, 40 minutes, forward only, nothing until the end
 *   weakness  a practice set pulled from the lowest-accuracy types
 *   review    only questions already answered, including mastered ones
 *
 * There is no negative marking on this test, which makes a blank strictly
 * worse than a guess. The interface is built to say so: leaving a question
 * takes a deliberate second action, and nothing is submitted without the
 * blanks being named first.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import Icon from '../../components/Icon';
import { Page } from '../../components/shell/AppShell';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Modal,
  Sheet,
  Skeleton,
  useToast,
} from '../../components/ui';
import { LABELS, clock, orderOptions, pct, reasonFor, secs, useClock, useReference } from '../../lib/tara';

const MODE_LABEL = {
  practice: 'Untimed practice',
  timed: 'Timed set',
  mock: 'Full module mock',
  weakness: 'Weakness set',
  review: 'Review set',
};

const MOCK_SECONDS = 40 * 60;

/* -------------------------------------------------------------------------- */
/* Reference, during untimed work only                                        */
/* -------------------------------------------------------------------------- */

function ReferenceSheet({ open, onClose }) {
  const { data, status } = useReference();
  return (
    <Sheet open={open} onClose={onClose} title="Reference">
      {status === 'loading' ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height="2rem" rounded="card" />
          ))}
        </div>
      ) : status === 'error' ? (
        <p className="text-sm text-alarm">The reference did not load. It is also at /tara/reference.</p>
      ) : (
        <div className="cd-refsheet">
          <section>
            <h3 className="cd-eyebrow">The four conditional forms</h3>
            <ul className="cd-reflist list-none">
              {data.conditionalForms.map((f) => (
                <li key={f.id}>
                  <span className="cd-reflist__name">
                    {f.name} <Badge tone={f.valid ? 'success' : 'danger'}>{f.valid ? 'valid' : 'invalid'}</Badge>
                  </span>
                  <span className="cd-reflist__shape">{f.skeleton}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="cd-eyebrow">The flaw catalogue</h3>
            <ul className="cd-reflist list-none">
              {data.flaws.map((f) => (
                <li key={f.id}>
                  <span className="cd-reflist__name">{f.name}</span>
                  <span className="cd-reflist__shape">{f.shape}</span>
                  <span className="cd-reflist__tell">{f.tell}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* One question                                                               */
/* -------------------------------------------------------------------------- */

function Question({ question, chosen, revealed, onChoose, number, total }) {
  const options = orderOptions(question.options);

  return (
    <article className="cd-question" aria-labelledby="q-stem">
      <p className="cd-question__count">
        <span className="cd-question__n">
          {number}
          <span className="cd-question__of"> / {total}</span>
        </span>
        {question.origin === 'real' ? <Badge tone="neutral">{question.source || 'Past paper'}</Badge> : null}
        <Badge tone="neutral">{question.difficulty}</Badge>
      </p>

      {question.passage ? <pre className="cd-passage">{question.passage}</pre> : null}
      <h2 id="q-stem" className="cd-question__stem">
        {question.stem}
      </h2>

      <ul className="cd-options list-none" role="radiogroup" aria-labelledby="q-stem">
        {options.map((o) => {
          const isChosen = chosen === o.label;
          const isKey = revealed && o.label === question.answer;
          const isMiss = revealed && isChosen && o.label !== question.answer;
          return (
            <li key={o.label}>
              <button
                type="button"
                role="radio"
                aria-checked={isChosen}
                disabled={revealed}
                className={[
                  'cd-option',
                  isChosen ? 'is-chosen' : '',
                  isKey ? 'is-key' : '',
                  isMiss ? 'is-miss' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onChoose(o.label)}
              >
                <span className="cd-option__label" aria-hidden="true">
                  {o.label}
                </span>
                <span className="cd-option__text">{o.text}</span>
                {isKey ? <Icon name="checkCircle" size={17} className="cd-option__mark" /> : null}
                {isMiss ? <Icon name="close" size={17} className="cd-option__mark" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/** The explanation. Why the key is right, then why each other option is not. */
function Explanation({ question, chosen }) {
  const options = orderOptions(question.options).filter((o) => o.label !== question.answer);
  return (
    <section className="cd-explain" aria-label="Explanation">
      <p className="cd-explain__verdict">
        {chosen === question.answer ? (
          <Badge tone="success">Right</Badge>
        ) : chosen ? (
          <Badge tone="danger">Wrong — you chose {chosen}</Badge>
        ) : (
          <Badge tone="warning">Left blank</Badge>
        )}
        <span className="cd-explain__key">The answer is {question.answer}.</span>
      </p>

      {question.route ? (
        <p className="cd-explain__route">
          <span className="cd-eyebrow">{question.module === 'ps' ? 'The route' : 'The skeleton'}</span>
          {question.route}
        </p>
      ) : null}

      <p className="cd-explain__why">{question.why}</p>

      <ul className="cd-explain__list list-none">
        {options.map((o) => (
          <li key={o.label} className={chosen === o.label ? 'is-yours' : ''}>
            <span className="cd-explain__opt">{o.label}</span>
            <span>{reasonFor(question, o.label) || 'No explanation was recorded for this option.'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Results                                                                    */
/* -------------------------------------------------------------------------- */

function Results({ set, answers, elapsed, mode, onAgain }) {
  const right = set.questions.filter((q) => answers[q.id] === q.answer).length;
  const blank = set.questions.filter((q) => !answers[q.id]).length;
  const total = set.questions.length;

  return (
    <Page>
      <header className="cd-result">
        <p className="cd-eyebrow">{MODE_LABEL[mode]} · finished</p>
        <p className="cd-result__score">
          {right}
          <span className="cd-result__of">/{total}</span>
        </p>
        <p className="cd-result__line">
          {pct(total ? right / total : null)} · {clock(elapsed)} · {secs(total ? elapsed / total : null)} a question
          {blank ? ` · ${blank} left blank` : ''}
        </p>
        {blank ? (
          <p className="cd-result__blank">
            {blank === 1 ? 'One question was' : `${blank} questions were`} left blank. There is no negative
            marking on this test, so a guess could only have helped.
          </p>
        ) : null}
        <div className="cd-result__actions">
          <Button variant="secondary" icon="refresh" onClick={onAgain}>
            Another set
          </Button>
          <ButtonLink variant="tertiary" href={`/tara/${set.module}`}>
            Back to the module
          </ButtonLink>
        </div>
      </header>

      <ol className="cd-review list-none">
        {set.questions.map((q, i) => (
          <li key={q.id} className="cd-review__item">
            <Question
              question={q}
              chosen={answers[q.id] || null}
              revealed
              onChoose={() => {}}
              number={i + 1}
              total={total}
            />
            <Explanation question={q} chosen={answers[q.id] || null} />
          </li>
        ))}
      </ol>
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function DrillScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const module = params.get('module') || 'ct';
  const sub = params.get('sub') || '';
  const mode = params.get('mode') || 'practice';
  const count = params.get('count') || '10';
  const origin = params.get('origin') || 'any';

  const untimed = mode === 'practice' || mode === 'weakness' || mode === 'review';
  const canGoBack = mode !== 'mock';

  const [set, setSet] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [times, setTimes] = useState({});
  const [revealed, setRevealed] = useState({});
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const shownAt = useRef(Date.now());
  const submitted = useRef(false);

  /* ---- load the set ---- */
  useEffect(() => {
    let alive = true;
    setStatus('loading');
    api.tara
      .drill({ module, subcategory: sub, mode, count, origin })
      .then((s) => {
        if (!alive) return;
        setSet(s);
        setStatus('ready');
        shownAt.current = Date.now();
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [module, sub, mode, count, origin]);

  const limit = useMemo(() => {
    if (untimed || !set) return null;
    if (mode === 'mock') return MOCK_SECONDS;
    return set.questions.length * (set.secondsPerQuestion || 110);
  }, [untimed, set, mode]);

  const { elapsed, remaining, expired } = useClock({ running: status === 'ready' && !done, limitSec: limit });

  const questions = set?.questions || [];
  const current = questions[index];
  const blanks = questions.filter((q) => !answers[q.id]);

  /* ---- record and finish ---- */
  const finish = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSaving(true);
    const rows = questions.map((q) => ({
      questionId: q.id,
      chosen: answers[q.id] || null,
      seconds: Math.round(times[q.id] || 0),
      mode,
    }));
    try {
      await api.tara.record(rows);
    } catch (e) {
      // The set is still worth reviewing even if the record did not save, so
      // this says what happened rather than throwing the work away.
      toast({
        tone: 'danger',
        title: 'Your answers did not save',
        description: `${e.message} Your review below is still correct, but this set will not count towards progress.`,
      });
    }
    setSaving(false);
    setDone(true);
  }, [questions, answers, times, mode, toast]);

  // Out of time is out of time: a timed set that runs over submits itself.
  useEffect(() => {
    if (expired && !done && status === 'ready') finish();
  }, [expired, done, status, finish]);

  const bank = () => {
    if (!current) return;
    const spent = (Date.now() - shownAt.current) / 1000;
    setTimes((t) => ({ ...t, [current.id]: (t[current.id] || 0) + spent }));
    shownAt.current = Date.now();
  };

  const choose = (label) => {
    if (!current || revealed[current.id]) return;
    setAnswers((a) => ({ ...a, [current.id]: label }));
    // Untimed work is for learning, so the explanation lands immediately.
    if (untimed) {
      bank();
      setRevealed((r) => ({ ...r, [current.id]: true }));
    }
  };

  const go = (delta) => {
    bank();
    setIndex((i) => Math.max(0, Math.min(questions.length - 1, i + delta)));
    shownAt.current = Date.now();
  };

  const next = () => {
    if (!answers[current?.id] && !confirmSkip) {
      setConfirmSkip(true);
      return;
    }
    setConfirmSkip(false);
    if (index === questions.length - 1) {
      bank();
      if (blanks.length && canGoBack) setConfirmSubmit(true);
      else finish();
      return;
    }
    go(1);
  };

  /* ---- states ---- */
  if (status === 'loading') {
    return (
      <Page>
        <Skeleton width="9rem" height="0.75rem" rounded="pill" />
        <Skeleton height="9rem" rounded="card" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height="3rem" rounded="card" />
        ))}
      </Page>
    );
  }

  if (status === 'error') {
    return (
      <Page>
        <ErrorState
          title="The set did not build"
          body="The server did not answer. Your bank is untouched. Check your connection and try again."
          detail={error}
          onRetry={() => router.refresh()}
          action={{ label: 'Back to the module', href: `/tara/${module}` }}
        />
      </Page>
    );
  }

  if (!questions.length) {
    return (
      <Page>
        <EmptyState
          icon="layers"
          title={mode === 'review' ? 'Nothing to review yet' : 'No questions are ready'}
          body={
            mode === 'review'
              ? 'A review set is built from questions you have already answered. Drill a normal set first and they will appear here.'
              : 'You have answered everything in this type correctly twice. More are being written in the background — come back shortly, or drill another type.'
          }
          action={{ label: 'Back to the module', href: `/tara/${module}`, icon: 'arrowLeft' }}
        />
      </Page>
    );
  }

  if (done) {
    return (
      <Results
        set={set}
        answers={answers}
        elapsed={elapsed}
        mode={mode}
        onAgain={() => window.location.reload()}
      />
    );
  }

  const showExplanation = untimed && revealed[current.id];

  return (
    <Page>
      <header className="cd-drillbar">
        <div className="cd-drillbar__left">
          <ButtonLink variant="ghost" size="sm" icon="arrowLeft" href={`/tara/${module}`}>
            Leave
          </ButtonLink>
          <span className="cd-drillbar__mode">{MODE_LABEL[mode]}</span>
        </div>

        <div className="cd-drillbar__right">
          {untimed ? (
            <Button variant="ghost" size="sm" icon="notes" onClick={() => setShowRef(true)}>
              Reference
            </Button>
          ) : null}
          <span
            className={remaining != null && remaining < 60 ? 'cd-drillbar__clock is-low' : 'cd-drillbar__clock'}
            role="timer"
            aria-live="off"
          >
            {remaining != null ? clock(remaining) : clock(elapsed)}
          </span>
        </div>
      </header>

      {/* Progress is a row of marks, not a bar: in a mock it is the only way to
          see how many are left, and it never reveals whether one was right. */}
      <ol className="cd-pips list-none" aria-label={`Question ${index + 1} of ${questions.length}`}>
        {questions.map((q, i) => (
          <li
            key={q.id}
            className={[
              'cd-pip',
              i === index ? 'is-here' : '',
              answers[q.id] ? 'is-answered' : '',
              i < index && !answers[q.id] ? 'is-blank' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={i === index ? 'step' : undefined}
          />
        ))}
      </ol>

      {set.shortfall > 0 ? (
        <p className="cd-drill__short">
          You asked for {set.requested} and the bank had {questions.length}. Generate more to fill a full set.
        </p>
      ) : null}

      <Question
        question={current}
        chosen={answers[current.id] || null}
        revealed={Boolean(revealed[current.id])}
        onChoose={choose}
        number={index + 1}
        total={questions.length}
      />

      {showExplanation ? <Explanation question={current} chosen={answers[current.id] || null} /> : null}

      {confirmSkip ? (
        <p className="cd-skipwarn" role="alert">
          <Icon name="alertTriangle" size={16} />
          <span>
            This one is blank. There is no negative marking, so a guess can only help you — press Next again to
            leave it anyway.
          </span>
        </p>
      ) : null}

      <div className="cd-drillnav">
        {canGoBack ? (
          <Button variant="tertiary" icon="arrowLeft" disabled={index === 0} onClick={() => go(-1)}>
            Back
          </Button>
        ) : (
          <span className="cd-drillnav__locked">
            <Icon name="info" size={14} /> Forward only, like the real thing
          </span>
        )}

        <Button
          variant={index === questions.length - 1 ? 'primary' : 'secondary'}
          iconEnd={index === questions.length - 1 ? undefined : 'arrowRight'}
          loading={saving}
          onClick={next}
        >
          {index === questions.length - 1 ? 'Finish' : 'Next'}
        </Button>
      </div>

      <ReferenceSheet open={showRef} onClose={() => setShowRef(false)} />

      <Modal
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        title="Some are still blank"
        description="Nothing is deducted for a wrong answer. A blank scores nothing; a guess scores one in five. Fill them in."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                const first = questions.findIndex((q) => !answers[q.id]);
                setIndex(first < 0 ? 0 : first);
                shownAt.current = Date.now();
                setConfirmSubmit(false);
              }}
            >
              Go to the first blank
            </Button>
            <Button variant="danger" loading={saving} onClick={finish}>
              Submit anyway
            </Button>
          </>
        }
      >
        <ul className="cd-blanklist list-none">
          {blanks.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => {
                  setIndex(questions.indexOf(q));
                  shownAt.current = Date.now();
                  setConfirmSubmit(false);
                }}
              >
                Question {questions.indexOf(q) + 1}
                <span>{q.stem.slice(0, 64)}…</span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </Page>
  );
}

export default DrillScreen;
