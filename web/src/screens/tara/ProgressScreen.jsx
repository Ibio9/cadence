'use client';

/**
 * Progress, told honestly.
 *
 * The brief for this screen is one sentence: if I am at 60% on parallel
 * reasoning, say so plainly rather than showing an encouraging average. So
 * there is no single headline number, weak types are sorted to the top rather
 * than buried in alphabetical order, and a type with no attempts says
 * "untried" instead of borrowing the module's average.
 */

import { Page } from '../../components/shell/AppShell';
import Icon from '../../components/Icon';
import { Badge, ButtonLink, EmptyState, ErrorState, PageHeading, Skeleton } from '../../components/ui';
import { pct, secs, standing, useTaraProgress } from '../../lib/tara';

/* -------------------------------------------------------------------------- */
/* Readiness                                                                  */
/* -------------------------------------------------------------------------- */

function Readiness({ readiness, mocks }) {
  const rows = Object.values(readiness || {});
  return (
    <section className="cd-section" aria-label="Readiness">
      <h2 className="cd-section__title">Against the target</h2>
      <p className="cd-section__lead">
        Twenty to twenty-two out of twenty-two, consistently, inside the time. Both halves count — a good score
        that takes fifty minutes is not a good score.
      </p>

      <ul className="cd-readycards list-none">
        {rows.map((r) => {
          const ready = r.projected != null && r.projected >= r.target && r.onPace;
          return (
            <li key={r.module} className={ready ? 'cd-readycard is-ready' : 'cd-readycard'}>
              <p className="cd-readycard__name">{r.name}</p>
              {r.answered === 0 ? (
                <p className="cd-readycard__none">Nothing answered yet — no view on this one.</p>
              ) : (
                <>
                  <p className="cd-readycard__score">
                    {r.projected}
                    <span>/22</span>
                  </p>
                  <p className="cd-readycard__basis">
                    projected from {pct(r.accuracy)} over the last {Math.min(r.answered, 60)}
                  </p>
                  <p className="cd-readycard__pace">
                    <Icon name="clock" size={14} />
                    {secs(r.pace)} a question against {secs(r.budget)}
                    {r.onPace ? null : <Badge tone="danger">over</Badge>}
                  </p>
                  <p className="cd-readycard__gap">
                    {ready
                      ? 'On target. Hold it.'
                      : r.projected >= r.target
                        ? `Accuracy is there; you are ${secs(r.pace - r.budget)} a question too slow.`
                        : `${r.target - r.projected} marks short of the target.`}
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {mocks.length ? (
        <ul className="cd-mocks list-none">
          {mocks.slice(0, 6).map((m, i) => (
            <li key={i}>
              <span className="cd-mocks__score">
                {m.score}/{m.outOf}
              </span>
              <span className="cd-mocks__module">{m.module === 'ct' ? 'Critical Thinking' : 'Problem Solving'}</span>
              <span className="cd-mocks__time">{Math.round(m.seconds / 60)} min</span>
              {m.skipped ? <span className="cd-mocks__blank">{m.skipped} blank</span> : null}
              <span className="cd-mocks__when">{new Date(m.at).toLocaleDateString('en-GB')}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cd-empty-inline">No full mocks sat yet. A mock is the only thing that tests the pace.</p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Accuracy by type                                                           */
/* -------------------------------------------------------------------------- */

function ByType({ modules }) {
  return (
    <section className="cd-section" aria-label="Accuracy by type">
      <h2 className="cd-section__title">Where you are weak</h2>
      <p className="cd-section__lead">Worst first. Untried types are listed last, and carry no percentage.</p>

      {modules
        .filter((m) => m.kind === 'mcq')
        .map((m) => {
          const tried = m.subcategories.filter((s) => s.asked).sort((a, b) => a.accuracy - b.accuracy);
          const untried = m.subcategories.filter((s) => !s.asked);
          return (
            <div key={m.id} className="cd-bytype">
              <h3 className="cd-bytype__module">{m.name}</h3>
              {tried.length === 0 ? (
                <p className="cd-empty-inline">Nothing answered in this module yet.</p>
              ) : (
                <ul className="cd-bars list-none">
                  {tried.map((s) => {
                    const st = standing(s.accuracy);
                    return (
                      <li key={s.id} className="cd-bar">
                        <span className="cd-bar__name">{s.name}</span>
                        <span className="cd-bar__track" aria-hidden="true">
                          <span className={`cd-bar__fill is-${st.tone}`} style={{ width: `${s.accuracy * 100}%` }} />
                        </span>
                        <span className="cd-bar__value">{pct(s.accuracy)}</span>
                        <span className="cd-bar__count">
                          {s.right}/{s.asked}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {untried.length ? (
                <p className="cd-bytype__untried">
                  Untried: {untried.map((s) => s.name).join(', ')}.
                </p>
              ) : null}
            </div>
          );
        })}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Time and flaws                                                             */
/* -------------------------------------------------------------------------- */

function Timing({ timing }) {
  const bleeding = timing.flatMap((m) =>
    m.subcategories
      .filter((s) => s.avgSeconds != null && s.avgSeconds > m.budget)
      .map((s) => ({ ...s, module: m.name, budget: m.budget })),
  );

  return (
    <section className="cd-section" aria-label="Time per question">
      <h2 className="cd-section__title">Where the minutes go</h2>
      <p className="cd-section__lead">
        Against the budget — {secs(timing[0]?.budget)} a question in Critical Thinking, {secs(timing[1]?.budget)}{' '}
        in Problem Solving.
      </p>
      {bleeding.length === 0 ? (
        <p className="cd-empty-inline">Nothing is running over budget. That is the pace you need to hold.</p>
      ) : (
        <ul className="cd-timing list-none">
          {bleeding
            .sort((a, b) => b.avgSeconds - a.avgSeconds)
            .map((s) => (
              <li key={`${s.module}-${s.id}`}>
                <span className="cd-timing__name">{s.name}</span>
                <span className="cd-timing__over">+{secs(s.avgSeconds - s.budget)}</span>
                <span className="cd-timing__detail">
                  {secs(s.avgSeconds)} against {secs(s.budget)}, over {s.asked}
                </span>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function Flaws({ flaws }) {
  if (!flaws.length) return null;
  const missed = flaws.filter((f) => f.missed > 0);
  return (
    <section className="cd-section" aria-label="Flaws missed">
      <h2 className="cd-section__title">The flaws you keep missing</h2>
      <p className="cd-section__lead">By name, from the catalogue, worst first.</p>
      {missed.length === 0 ? (
        <p className="cd-empty-inline">You have not missed a flaw yet.</p>
      ) : (
        <ul className="cd-flaws list-none">
          {missed.map((f) => (
            <li key={f.id}>
              <span className="cd-flaws__name">{f.name}</span>
              <span className="cd-flaws__shape">{f.shape}</span>
              <span className="cd-flaws__score">
                {f.asked - f.missed}/{f.asked}
              </span>
              <Badge tone={standing(f.accuracy).tone}>{pct(f.accuracy)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Trend                                                                      */
/* -------------------------------------------------------------------------- */

function Trend({ trend }) {
  const series = Object.entries(trend).filter(([, points]) => points.length >= 2);
  if (!series.length) {
    return (
      <section className="cd-section" aria-label="Trend">
        <h2 className="cd-section__title">Trend</h2>
        <p className="cd-empty-inline">
          Not enough answered yet. A trend needs at least forty questions in a module before it means anything.
        </p>
      </section>
    );
  }

  return (
    <section className="cd-section" aria-label="Trend">
      <h2 className="cd-section__title">Trend</h2>
      <p className="cd-section__lead">Accuracy over each block of twenty answers, oldest first.</p>
      {series.map(([module, points]) => (
        <div key={module} className="cd-trend">
          <p className="cd-trend__name">{module === 'ct' ? 'Critical Thinking' : 'Problem Solving'}</p>
          <ol className="cd-trend__row list-none">
            {points.map((p) => (
              <li key={p.upTo} className="cd-trend__col" title={`${pct(p.accuracy)} at ${p.upTo} answered`}>
                <span className={`cd-trend__bar is-${standing(p.accuracy).tone}`} style={{ height: `${Math.max(4, p.accuracy * 100)}%` }} />
                <span className="cd-trend__tick">{pct(p.accuracy)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function ProgressScreen() {
  const { data, status, error, reload } = useTaraProgress();

  if (status === 'loading' && !data) {
    return (
      <Page>
        <Skeleton width="7rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(14rem,55%)" height="2.2rem" rounded="pill" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height="8rem" rounded="card" />
        ))}
      </Page>
    );
  }

  if (status === 'error' && !data) {
    return (
      <Page>
        <ErrorState
          title="Progress could not be loaded"
          body="Your attempts are safe on the server. This is a connection problem, not lost work."
          detail={error}
          onRetry={reload}
        />
      </Page>
    );
  }

  const answered = data.modules.reduce((n, m) => n + m.asked, 0);

  return (
    <Page>
      <PageHeading
        eyebrow="TARA Drill"
        title="Progress"
        lead="Nothing here is rounded up. A weak type is shown as a weak type."
        actions={
          <ButtonLink variant="secondary" icon="arrowLeft" href="/tara">
            TARA Drill
          </ButtonLink>
        }
      />

      {answered === 0 ? (
        <EmptyState
          icon="target"
          title="Nothing answered yet"
          body="Drill a set and this fills in: accuracy per type, where the minutes go, which flaws you keep missing, and how far you are from 20 out of 22."
          action={{ label: 'Open Critical Thinking', href: '/tara/ct', icon: 'arrowRight' }}
        />
      ) : (
        <>
          <Readiness readiness={data.readiness} mocks={data.mocks} />
          <ByType modules={data.modules} />
          <Timing timing={data.timing} />
          <Flaws flaws={data.flaws} />
          <Trend trend={data.trend} />
        </>
      )}
    </Page>
  );
}

export default ProgressScreen;
