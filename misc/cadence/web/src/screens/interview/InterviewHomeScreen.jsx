'use client';

/**
 * The interview drill: start one, and read the trend.
 *
 * The trend is the point of keeping the history. One brutal critique is a bad
 * afternoon; five of them with structure climbing and delivery flat is a thing
 * you can act on. So the dimensions are drawn as five thin lines on the same
 * axis rather than five numbers — the shape is the information.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../lib/api';
import { Page } from '../../components/shell/AppShell';
import Icon from '../../components/Icon';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  PageHeading,
  Skeleton,
  useToast,
} from '../../components/ui';
import { band, useInterviewState } from '../../lib/interview';

const STRAND_NAME = { philosophy: 'Philosophy', politics: 'Politics', economics: 'Economics' };

function HomeSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="8rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(18rem, 65%)" height="2.4rem" rounded="pill" />
      </div>
      <Skeleton height="10rem" rounded="card" />
      <Skeleton height="14rem" rounded="card" />
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/* The trend                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Five thin lines on one axis, 0 to 10, oldest sitting on the left.
 *
 * Drawn by hand rather than by a chart library because a chart library brings
 * a grid, a legend, a tooltip and a colour ramp, and four of those five would
 * be the brightest things on the screen. What is wanted here is the shape of
 * five lines on black.
 */
function Trend({ trend, dimensions }) {
  const points = trend?.points || [];
  if (points.length < 2) return null;

  const W = 640;
  const H = 200;
  const padX = 8;
  const padY = 12;
  const x = (i) => padX + (i / (points.length - 1)) * (W - padX * 2);
  const y = (v) => padY + (1 - v / 10) * (H - padY * 2);

  return (
    <section className="cd-section" aria-label="Score trend">
      <h2 className="cd-section__title">Where the numbers are going</h2>
      <p className="cd-section__lead">
        Every sitting, oldest first, out of ten. Seven is a borderline offer. The second round counts double —
        it is the answer you did not prepare.
      </p>

      <div className="cd-trendplot">
        <svg viewBox={`0 0 ${W} ${H}`} className="cd-trendplot__svg" role="img" aria-label="Score per dimension over time">
          {/* Seven is the only line worth drawing: it is the bar. */}
          <line x1={padX} y1={y(7)} x2={W - padX} y2={y(7)} className="cd-trendplot__bar" />
          {dimensions.map((d) => {
            const path = points
              .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.scores[d.id] ?? 0).toFixed(1)}`)
              .join(' ');
            return <path key={d.id} d={path} className={`cd-trendplot__line is-${d.id}`} />;
          })}
          {points.map((p, i) => (
            <circle key={p.id} cx={x(i)} cy={y(p.scores.reasoning ?? 0)} r="2" className="cd-trendplot__dot" />
          ))}
        </svg>

        <ul className="cd-trendkey list-none">
          {dimensions.map((d) => {
            const avg = trend.recent?.[d.id];
            return (
              <li key={d.id} className="cd-trendkey__row">
                <span className={`cd-trendkey__swatch is-${d.id}`} aria-hidden="true" />
                <span className="cd-trendkey__name">{d.name}</span>
                <span className="cd-trendkey__value">{avg == null ? '—' : avg.toFixed(1)}</span>
                {trend.weakest === d.id ? <Badge tone="warning">Weakest</Badge> : null}
              </li>
            );
          })}
        </ul>
      </div>

      {trend.weakest ? (
        <p className="cd-section__lead">
          Topics are being chosen against <strong>{dimensions.find((d) => d.id === trend.weakest)?.name}</strong> —
          the prompts that punish it come up more often until it moves.
        </p>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* History                                                                    */
/* -------------------------------------------------------------------------- */

function overall(scores) {
  const all = scores.flatMap((r) => (r.scores ? Object.values(r.scores) : []));
  if (!all.length) return null;
  return all.reduce((a, b) => a + b, 0) / all.length;
}

function SittingRow({ sitting }) {
  const avg = overall(sitting.scores);
  const b = band(avg);
  const unfinished = sitting.stage !== 'done';

  return (
    <li>
      <Link href={`/interview/${sitting.id}`} className="cd-sitrow">
        <span className="cd-sitrow__body">
          <span className="cd-sitrow__strand">{STRAND_NAME[sitting.strand] || sitting.strand}</span>
          <span className="cd-sitrow__prompt">{sitting.prompt}</span>
          {sitting.weakness ? <span className="cd-sitrow__weak">{sitting.weakness}</span> : null}
        </span>
        <span className="cd-sitrow__marks">
          {avg == null ? (
            <Badge tone="neutral">{unfinished ? 'Unfinished' : 'Unmarked'}</Badge>
          ) : (
            <>
              <span className="cd-sitrow__score">{avg.toFixed(1)}</span>
              <Badge tone={b.tone}>{b.label}</Badge>
            </>
          )}
          <Icon name="chevronRight" size={15} className="cd-sitrow__go" />
        </span>
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function InterviewHomeScreen() {
  const { data, status, error, reload } = useInterviewState();
  const { toast } = useToast();
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const sitting = await api.interview.start();
      router.push(`/interview/${sitting.id}`);
    } catch (e) {
      toast({ tone: 'danger', title: 'The sitting did not start', description: e.message });
      setStarting(false);
    }
  };

  if (status === 'loading' && !data) return <HomeSkeleton />;
  if (status === 'error' && !data) {
    return (
      <Page>
        <ErrorState
          title="The interview drill did not load"
          body="The server did not answer. Every sitting you have done is on it. Check your connection and try again."
          detail={error}
          onRetry={reload}
        />
      </Page>
    );
  }

  const unfinished = data.sessions.find((s) => s.stage !== 'done');

  return (
    <Page>
      <PageHeading
        eyebrow="Oxford PPE"
        title="Interview"
        lead="One prompt, fifteen minutes to think, five to answer. Then it tells you exactly where the argument gave way."
        actions={
          <Button variant="go" icon="play" size="lg" loading={starting} onClick={start}>
            Start
          </Button>
        }
      />

      {unfinished ? (
        <aside className="cd-resume">
          <div className="min-w-0">
            <p className="cd-resume__label">Still open</p>
            <p className="cd-resume__prompt">{unfinished.prompt}</p>
          </div>
          <ButtonLink variant="secondary" icon="arrowRight" href={`/interview/${unfinished.id}`}>
            Pick it up
          </ButtonLink>
        </aside>
      ) : null}

      <Trend trend={data.trend} dimensions={data.dimensions} />

      {data.sessions.length === 0 ? (
        <EmptyState
          title="Sit the first one"
          body="A prompt rotating across philosophy, politics and economics — a claim to interrogate, a result that runs against instinct, a case where two principles pull opposite ways. Fifteen minutes with a notes pane, then you speak to the camera for three to five. The marking quotes you back at yourself and does not soften anything."
          action={{ label: 'Start', onClick: start, icon: 'play', loading: starting }}
        />
      ) : (
        <section className="cd-section" aria-label="Past sittings">
          <h2 className="cd-section__title">Every sitting</h2>
          <ul className="cd-sitlist list-none">
            {data.sessions.map((s) => (
              <SittingRow key={s.id} sitting={s} />
            ))}
          </ul>
        </section>
      )}

      <p className="cd-poolline">
        {data.pool.writing
          ? 'More prompts are being written.'
          : `${data.pool.unseen} unseen ${data.pool.unseen === 1 ? 'prompt' : 'prompts'} in the pool.`}{' '}
        Transcription runs in this browser and costs nothing. The marking is one model call with live web search,
        so every work it names has been checked rather than remembered.
      </p>
    </Page>
  );
}

export default InterviewHomeScreen;
