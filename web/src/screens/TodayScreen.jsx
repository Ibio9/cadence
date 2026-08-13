'use client';

/**
 * Today.
 *
 * The front door, and the rail: one continuous line that is literal time, the
 * day's blocks hung off it in order, and a single bead where you actually
 * are. The entry the bead touches is the only one drawn at full size and the
 * only one lit. Everything above it recedes; everything below is a quiet
 * ruled line.
 *
 * The one question this screen answers is what to do in the next hour, so it
 * says that once, clearly, and does not also report how much of the day has
 * already gone. Habits sit underneath as a tally, marked off rather than
 * tracked, and never take the light.
 */

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { fmtDur, hhmm, todayKey } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import Icon from '../components/Icon';
import { Badge, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { formatDateLong } from '../lib/store';
import { openBlock } from '../lib/openBlock';
import { useChecklist } from '../lib/useChecklist';
import { useDay } from '../lib/useDay';

/* -------------------------------------------------------------------------- */
/* Loading: the real shape, so nothing moves when the day arrives             */
/* -------------------------------------------------------------------------- */

function TodaySkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="9rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(11rem, 50%)" height="2.4rem" rounded="pill" />
      </div>
      <div className="cd-rail">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="cd-railrow">
            <Skeleton width={i % 2 ? '55%' : '38%'} height="1.1rem" rounded="pill" />
            <Skeleton width="30%" height="0.75rem" rounded="pill" className="mt-2" />
          </div>
        ))}
      </div>
      <Skeleton height="6rem" rounded="card" />
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/* Time                                                                       */
/* -------------------------------------------------------------------------- */

/** "in 3h 9m". Never rounds to nothing: under a minute is still "in 1m". */
function untilLabel(mins) {
  if (mins <= 1) return 'in 1m';
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/* -------------------------------------------------------------------------- */
/* The rail                                                                   */
/* -------------------------------------------------------------------------- */

function RailRow({ block, project, state, nowMin }) {
  const until = state === 'next' && nowMin != null ? untilLabel(block.startMin - nowMin) : null;

  // Saying an hour has no objective is only worth the line while you can still
  // give it one. On a block that is behind you or already held it is a note
  // about a decision nobody can make any more, printed at the same weight as a
  // real objective, on the one screen whose argument is that a single thing
  // matters.
  const unset = state !== 'past' && block.status === 'pending';

  return (
    <li>
      <Link
        href={`/focus/${block.id}`}
        onClick={openBlock}
        className={`cd-railrow is-${state}`}
        aria-current={state === 'now' ? 'time' : undefined}
      >
        <span className="cd-railrow__time">
          {hhmm(block.startMin)}
          <span className="cd-railrow__dur">{fmtDur(block.endMin - block.startMin)}</span>
        </span>

        <span className="cd-railrow__tick" />

        <span className="cd-railrow__body">
          <span className="cd-railrow__title">{block.title}</span>
          <span className="cd-railrow__meta">
            {project ? <span className="cd-railrow__project">{project.name}</span> : null}
            {block.objective ? (
              <span className="truncate">{block.objective}</span>
            ) : unset ? (
              <span className="cd-railrow__unset">Not decided yet</span>
            ) : null}
          </span>
        </span>

        <span className="cd-railrow__marks">
          {state === 'now' ? <span className="cd-when cd-when--now">Now</span> : null}
          {until ? <span className="cd-when">{until}</span> : null}
          {/* Held is past tense, so it is written quietly and never tinted.
              Nothing on this screen is allowed to compete with what is
              happening now. Missed is the one thing that still wants you. */}
          {block.status === 'done' ? <span className="cd-when">Held</span> : null}
          {block.status === 'missed' ? <Badge tone="warning">Missed</Badge> : null}
          <Icon name="chevronRight" size={15} className="cd-railrow__go" />
        </span>
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* The tally                                                                  */
/* -------------------------------------------------------------------------- */

function Tally({ label, habits, checked, onToggle }) {
  if (!habits.length) return null;
  const done = habits.filter((h) => checked.includes(h.id)).length;

  return (
    <div className="cd-tally__group">
      <p className="cd-tally__label">
        {label}
        <span className="cd-tally__count">
          {done}/{habits.length}
        </span>
      </p>
      <ul className="cd-tally__list list-none">
        {habits.map((h) => {
          const held = checked.includes(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                className={held ? 'cd-tallycell is-held' : 'cd-tallycell'}
                aria-pressed={held}
                onClick={() => onToggle(h.id)}
              >
                <span className="cd-tallycell__mark" aria-hidden="true">
                  {held ? <Icon name="check" size={11} strokeWidth={3} /> : null}
                </span>
                <span className="cd-tallycell__label">{h.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function TodayScreen() {
  const { ready, habits, checked, toggle } = useChecklist();

  const [date, setDate] = useState('');
  useEffect(() => setDate(todayKey()), []);
  const { state, status, error, reload } = useDay(date);

  const [nowMin, setNowMin] = useState(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, []);

  const blocks = useMemo(
    () => [...(state?.blocks ?? [])].sort((a, b) => a.startMin - b.startMin),
    [state],
  );

  const projectsById = useMemo(() => {
    const map = {};
    for (const p of state?.projects ?? []) map[p.id] = p;
    return map;
  }, [state]);

  /**
   * Where the day is. One block can be `now`; if none is, the first one still
   * ahead is `next`. Everything behind is `past` and everything else `later`.
   */
  const { states, next, current } = useMemo(() => {
    const out = {};
    if (nowMin == null) return { states: out, next: null, current: null };
    let running = null;
    let upcoming = null;
    for (const b of blocks) {
      if (nowMin >= b.endMin) out[b.id] = 'past';
      else if (nowMin >= b.startMin) {
        out[b.id] = 'now';
        running = b;
      } else if (!upcoming) {
        out[b.id] = 'next';
        upcoming = b;
      } else out[b.id] = 'later';
    }
    // Only one thing can be the thing to do. If a block is running, the block
    // after it is just the next one along.
    if (running && upcoming) out[upcoming.id] = 'later';
    return { states: out, next: running ? null : upcoming, current: running };
  }, [blocks, nowMin]);

  const prayers = useMemo(() => habits.filter((h) => h.prayer), [habits]);
  const others = useMemo(() => habits.filter((h) => !h.prayer), [habits]);

  if (!date || (status === 'loading' && !state)) return <TodaySkeleton />;

  return (
    <Page>
      <header className="cd-daybar">
        <div className="min-w-0">
          <p className="cd-eyebrow">{formatDateLong()}</p>
          <h1 className="cd-daybar__title">Today</h1>
        </div>

        {/* When the next block is. Nothing about what has already been missed:
            at 21:00 a score of the day is the last thing that helps. When a
            block is already running, the lit row says it and this stays out.

            The countdown lives on the row rather than here, so the two say
            different things: this is when it is, that is how long you have. */}
        {next ? (
          <p className="cd-daybar__next">
            <span className="cd-daybar__nextlabel">Next</span>
            <span className="cd-daybar__nexttime">{hhmm(next.startMin)}</span>
          </p>
        ) : null}
      </header>

      {status === 'error' ? (
        <ErrorState
          title="The day did not load"
          body="The server did not answer. Your blocks are on it, not in this tab, so nothing is lost. Check your connection and try again."
          detail={error}
          onRetry={reload}
          retrying={status === 'loading'}
        />
      ) : blocks.length === 0 ? (
        <EmptyState
          icon="calendarPlus"
          title="Today is empty"
          body="Your rhythms fill the days you train. The rest you fill yourself. Open the timetable and name the first hour."
          action={{ label: 'Open the timetable', icon: 'timetable', href: '/timetable' }}
        />
      ) : (
        <ol className="cd-rail list-none" aria-label="The day">
          {blocks.map((block, i) => {
            const prev = blocks[i - 1];
            // The bead goes between blocks only when nothing is running. When
            // something is, it belongs on that block, not in a gap.
            const showBead =
              !current && nowMin != null && nowMin < block.startMin && (!prev || nowMin >= prev.endMin);

            return (
              <Fragment key={block.id}>
                {showBead ? (
                  <li className="cd-bead">
                    <span className="cd-bead__time">{hhmm(nowMin)}</span>
                    <span className="cd-bead__dot cd-breathes" />
                    <span className="sr-only">is the time now</span>
                  </li>
                ) : null}
                <RailRow
                  block={block}
                  project={projectsById[block.projectId]}
                  state={states[block.id] || 'later'}
                  nowMin={nowMin}
                />
              </Fragment>
            );
          })}
        </ol>
      )}

      {ready ? (
        <section className="cd-tally" aria-label="Habits">
          <Tally label="Salah" habits={prayers} checked={checked} onToggle={toggle} />
          <Tally label="Discipline" habits={others} checked={checked} onToggle={toggle} />
          {habits.length === 0 ? (
            <p className="text-caption text-ink-muted">
              Nothing to hold yet. <Link href="/settings">Add one in settings.</Link>
            </p>
          ) : null}
        </section>
      ) : (
        <Skeleton height="6rem" rounded="card" />
      )}
    </Page>
  );
}

export default TodayScreen;
