'use client';

/**
 * The reference.
 *
 * Method, not encouragement. The structured lists — the flaw catalogue, the
 * four conditional forms, the maths ceiling — are served from the same module
 * the generator writes questions from, so what you revise and what you are
 * tested on cannot drift apart. The prose around them is the attack method
 * for each question type and the two techniques the paper actually rewards:
 * eliminating fast, and not running out of time.
 *
 * Reachable from untimed practice, and deliberately not from a timed set.
 */

import { Page } from '../../components/shell/AppShell';
import { Badge, ButtonLink, ErrorState, PageHeading, Skeleton, Tabs } from '../../components/ui';
import { secs, useReference } from '../../lib/tara';
import { useState } from 'react';

/* -------------------------------------------------------------------------- */
/* Prose                                                                      */
/* -------------------------------------------------------------------------- */

const NEGATION_TEST = {
  title: 'The negation test',
  body: 'The one reliable way to settle an assumption question. Take the option and negate it — flatly, not partially. If the argument now collapses, that option was an assumption the argument needed. If the argument still stands, it was not. Most wrong options survive negation comfortably, which is exactly what makes them wrong.',
  worked: [
    'Argument: the new timetable will cut delays, because it leaves longer gaps between services.',
    'Candidate: delays are currently caused by gaps that are too short.',
    'Negated: delays are NOT currently caused by short gaps.',
    'The argument collapses — longer gaps would fix nothing. So it is an assumption.',
  ],
};

const ELIMINATION = {
  title: 'The five eliminations',
  body: 'Run these before you weigh anything up. On a good day four options die here and the question is over in thirty seconds.',
  rules: [
    ['Out of scope', 'It brings in something the passage never mentioned. New information is not your job to supply.'],
    ['Too strong', 'It says all, never, or must where the passage supports only some, rarely, or may. One counter-example kills it.'],
    ['True but idle', 'It is correct about the world and does nothing to the inference. Relevance beats truth here.'],
    ['A premise in disguise', 'It restates something already given instead of doing the job the stem asked for.'],
    ['Answers another question', 'It would be right if the stem had asked something else. Re-read the stem, not the option.'],
  ],
};

const NO_CALCULATOR = {
  title: 'Without a calculator',
  body: 'The arithmetic is deliberately easy. If it has got hard, you have taken the wrong route — back up rather than pushing through.',
  rules: [
    ['Estimate first', 'Round hard, get an approximate answer, and eliminate. Often only one option is in range and you are done.'],
    ['Fractions over decimals', 'Three sevenths of 91 is one division. 0.4285… × 91 is a mistake waiting to happen.'],
    ['Ten per cent, then scale', '10% is a decimal point. 5% is half of that, 30% is three of them, 17.5% is 10 + 5 + 2.5.'],
    ['Factor the awkward one', '× 5 is ÷ 2 then × 10. × 25 is ÷ 4 then × 100. × 9 is × 10 minus one lot.'],
    ['Whole pence', 'Work in pence and put the point back at the very end. Decimals mid-calculation cost marks.'],
    ['Name the scale factor', 'Lengths go by k, areas by k², volumes by k³. Write k down before you do anything else.'],
  ],
};

const TIME_MODEL = {
  title: 'The time models',
  body: 'Both multiple-choice modules are twenty-two questions in forty minutes, timed separately. The budget is tight but not brutal — the failure mode is not being slow overall, it is spending six minutes on one question.',
  models: [
    [
      'Critical Thinking · 1m 50s each',
      'First pass at about 1m 20s: answer everything you can see. Mark the rest and move. That buys roughly ten minutes for the ones that need it. Never leave a passage unanswered at the end — there is no negative marking.',
    ],
    [
      'Problem Solving · just under 2m each',
      'Read the question before the table. If you cannot see a route inside twenty seconds, guess, mark it, and move on — the route either appears quickly or it is the wrong route.',
    ],
    [
      'Writing task · 40 minutes',
      'Five minutes planning all three parts, thirty writing, five reading it back for slips. The plan is what stops part 3 turning into a summary of part 1.',
    ],
  ],
};

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function ReferenceScreen() {
  const { data, status, error, reload } = useReference();
  const [tab, setTab] = useState('types');

  if (status === 'loading' && !data) {
    return (
      <Page>
        <Skeleton width="7rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(14rem,55%)" height="2.2rem" rounded="pill" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height="4rem" rounded="card" />
        ))}
      </Page>
    );
  }

  if (status === 'error' && !data) {
    return (
      <Page>
        <ErrorState
          title="The reference could not be loaded"
          body="This is a connection problem — nothing here is stored on this device."
          detail={error}
          onRetry={reload}
        />
      </Page>
    );
  }

  const ct = data.modules.find((m) => m.id === 'ct');
  const ps = data.modules.find((m) => m.id === 'ps');

  return (
    <Page>
      <PageHeading
        eyebrow="TARA Drill"
        title="Reference"
        lead="How each type is attacked, and the two techniques that decide whether you finish."
        actions={
          <ButtonLink variant="secondary" icon="arrowLeft" href="/tara">
            TARA Drill
          </ButtonLink>
        }
      />

      <Tabs
        items={[
          { value: 'types', label: 'Question types' },
          { value: 'logic', label: 'Logic' },
          { value: 'flaws', label: 'Flaw catalogue' },
          { value: 'method', label: 'Method' },
          { value: 'time', label: 'Time' },
        ]}
        value={tab}
        onChange={setTab}
        label="Reference sections"
      />

      {tab === 'types' ? (
        <>
          <section className="cd-section">
            <h2 className="cd-section__title">Critical Thinking — the seven types</h2>
            <ol className="cd-types list-none">
              {ct.subcategories.map((s, i) => (
                <li key={s.id}>
                  <span className="cd-types__n">{i + 1}</span>
                  <span className="cd-types__body">
                    <span className="cd-types__name">{s.name}</span>
                    <span className="cd-types__attack">{s.attack}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="cd-section">
            <h2 className="cd-section__title">Problem Solving — the three operations</h2>
            <p className="cd-section__lead">
              Every question is one of these three. Naming which one you are looking at is most of the work.
            </p>
            {ps.groups.map((g) => (
              <div key={g.id} className="cd-opgroup">
                <h3 className="cd-opgroup__name">{g.name}</h3>
                <p className="cd-opgroup__blurb">{g.blurb}</p>
                <ul className="cd-types list-none">
                  {ps.subcategories
                    .filter((s) => s.group === g.id)
                    .map((s) => (
                      <li key={s.id}>
                        <span className="cd-types__body">
                          <span className="cd-types__name">{s.name}</span>
                          <span className="cd-types__attack">{s.attack}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      ) : null}

      {tab === 'logic' ? (
        <>
          <section className="cd-section">
            <h2 className="cd-section__title">The four conditional forms</h2>
            <p className="cd-section__lead">
              Two are valid and two are not. Most conditional questions on the paper are one of these four wearing
              a subject.
            </p>
            <ul className="cd-forms list-none">
              {data.conditionalForms.map((f) => (
                <li key={f.id} className={f.valid ? 'cd-form is-valid' : 'cd-form is-invalid'}>
                  <p className="cd-form__head">
                    <span className="cd-form__name">{f.name}</span>
                    <Badge tone={f.valid ? 'success' : 'danger'}>{f.valid ? 'Valid' : 'Invalid'}</Badge>
                  </p>
                  <p className="cd-form__skeleton">{f.skeleton}</p>
                  <p className="cd-form__note">{f.note}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="cd-section">
            <h2 className="cd-section__title">{NEGATION_TEST.title}</h2>
            <p className="cd-section__lead">{NEGATION_TEST.body}</p>
            <ol className="cd-worked list-none">
              {NEGATION_TEST.worked.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </section>
        </>
      ) : null}

      {tab === 'flaws' ? (
        <section className="cd-section">
          <h2 className="cd-section__title">The flaw catalogue</h2>
          <p className="cd-section__lead">
            Name the flaw before you read the options. If you can say what went wrong in your own words, the right
            option is the one that says it back to you.
          </p>
          <ul className="cd-flawlist list-none">
            {data.flaws.map((f) => (
              <li key={f.id}>
                <span className="cd-flawlist__name">{f.name}</span>
                <span className="cd-flawlist__shape">{f.shape}</span>
                <span className="cd-flawlist__tell">{f.tell}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'method' ? (
        <>
          <section className="cd-section">
            <h2 className="cd-section__title">{ELIMINATION.title}</h2>
            <p className="cd-section__lead">{ELIMINATION.body}</p>
            <ol className="cd-rules list-none">
              {ELIMINATION.rules.map(([name, body], i) => (
                <li key={name}>
                  <span className="cd-rules__n">{i + 1}</span>
                  <span className="cd-rules__body">
                    <span className="cd-rules__name">{name}</span>
                    <span className="cd-rules__text">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="cd-section">
            <h2 className="cd-section__title">{NO_CALCULATOR.title}</h2>
            <p className="cd-section__lead">{NO_CALCULATOR.body}</p>
            <ul className="cd-rules list-none">
              {NO_CALCULATOR.rules.map(([name, body]) => (
                <li key={name}>
                  <span className="cd-rules__body">
                    <span className="cd-rules__name">{name}</span>
                    <span className="cd-rules__text">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
            <pre className="cd-ceiling">{data.mathsCeiling}</pre>
          </section>
        </>
      ) : null}

      {tab === 'time' ? (
        <section className="cd-section">
          <h2 className="cd-section__title">{TIME_MODEL.title}</h2>
          <p className="cd-section__lead">{TIME_MODEL.body}</p>
          <ul className="cd-rules list-none">
            {TIME_MODEL.models.map(([name, body]) => (
              <li key={name}>
                <span className="cd-rules__body">
                  <span className="cd-rules__name">{name}</span>
                  <span className="cd-rules__text">{body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="cd-section__lead">
            The budget the app holds you to: {secs(ct.secondsPerQuestion)} a question in Critical Thinking,{' '}
            {secs(ps.secondsPerQuestion)} in Problem Solving.
          </p>
        </section>
      ) : null}
    </Page>
  );
}

export default ReferenceScreen;
