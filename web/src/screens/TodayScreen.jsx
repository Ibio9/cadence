'use client';

/**
 * Today.
 *
 * The front door, and the day spine: the hours of today in order, the now
 * marker where you actually are in them, and every block a link into Focus.
 * Blocks come first because the blocks are the day. The habits sit underneath
 * as one compact strip — they are ticks against a standard, not the plan.
 *
 * The spine is the database's day. The strip is local. Nothing on this screen
 * invents either.
 */

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { fmtDur, hhmm, todayKey } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import Icon from '../components/Icon';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { formatDateLong } from '../lib/store';
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
        <Skeleton width="min(14rem, 60%)" height="2.4rem" rounded="pill" />
      </div>
      <ul className="cd-spine list-none">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="cd-spinerow">
            <Skeleton width="3rem" height="1rem" rounded="pill" />
            <Skeleton width={i % 2 ? '55%' : '40%'} height="1.4rem" rounded="pill" />
          </li>
        ))}
      </ul>
      <Skeleton height="7rem" rounded="card" />
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/* The spine                                                                  */
/* -------------------------------------------------------------------------- */

/** "in 3h 9m", or "now" once it has started. */
function untilLabel(mins) {
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

function SpineRow({ block, project, state, nowMin }) {
  const until = state === 'next' && nowMin != null ? untilLabel(block.startMin - nowMin) : null;

  return (
    <li>
      <Link
        href={`/focus/${block.id}`}
        className={`cd-spinerow is-${state}`}
        style={project?.color ? { '--block-colour': project.color } : undefined}
        aria-current={state === 'now' ? 'time' : undefined}
      >
        <span className="cd-spinerow__time">
          <span className="cd-spinerow__start">{hhmm(block.startMin)}</span>
          <span className="cd-spinerow__dur">{fmtDur(block.endMin - block.startMin)}</span>
        </span>

        <span className="cd-spinerow__body">
          <span className="cd-spinerow__title">{block.title}</span>
          <span className="cd-spinerow__meta">
            {project ? <span className="cd-spinerow__project">{project.name}</span> : null}
            <span className="truncate">{block.objective || 'No objective yet'}</span>
          </span>
        </span>

        <span className="cd-spinerow__marks">
          {state === 'now' ? <span className="cd-tag cd-tag--now">Now</span> : null}
          {until ? <span className="cd-tag">{until}</span> : null}
          {block.status === 'done' ? <Badge tone="success" icon="checkCircle">Held</Badge> : null}
          {block.status === 'missed' ? <Badge tone="warning" icon="alertTriangle">Missed</Badge> : null}
          <Icon name="chevronRight" size={16} className="cd-spinerow__go" />
        </span>
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* The habits strip                                                           */
/* -------------------------------------------------------------------------- */

function HabitStrip({ label, habits, checked, onToggle }) {
  if (!habits.length) return null;
  const done = habits.filter((h) => checked.includes(h.id)).length;

  return (
    <div className="cd-strip__group">
      <p className="cd-strip__label">
        {label}
        <span className="cd-strip__count">
          {done}/{habits.length}
        </span>
      </p>
      <ul className="cd-strip__list list-none">
        {habits.map((h) => {
          const on = checked.includes(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                className={on ? 'cd-chip is-on' : 'cd-chip'}
                aria-pressed={on}
                onClick={() => onToggle(h.id)}
              >
                <Icon name={on ? 'check' : 'plus'} size={13} strokeWidth={2.5} />
                <span>{h.label}</span>
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
  const states = useMemo(() => {
    const out = {};
    if (nowMin == null) return out;
    let markedNext = false;
    for (const b of blocks) {
      if (nowMin >= b.endMin) out[b.id] = 'past';
      else if (nowMin >= b.startMin) out[b.id] = 'now';
      else if (!markedNext) {
        out[b.id] = 'next';
        markedNext = true;
      } else out[b.id] = 'later';
    }
    if (Object.values(out).includes('now')) {
      for (const [id, s] of Object.entries(out)) if (s === 'next') out[id] = 'later';
    }
    return out;
  }, [blocks, nowMin]);

  const prayers = useMemo(() => habits.filter((h) => h.prayer), [habits]);
  const others = useMemo(() => habits.filter((h) => !h.prayer), [habits]);

  if (!date || (status === 'loading' && !state)) return <TodaySkeleton />;

  const held = blocks.filter((b) => b.status === 'done').length;

  return (
    <Page>
      <header className="cd-daybar">
        <div className="min-w-0">
          <p className="cd-eyebrow">{formatDateLong()}</p>
          <h1 className="cd-daybar__title">Today</h1>
        </div>
        {blocks.length ? (
          <p className="cd-daybar__count">
            <span className="cd-daybar__held">{held}</span>
            <span className="cd-daybar__of">of {blocks.length} held</span>
          </p>
        ) : null}
      </header>

      {status === 'error' ? (
        <Card>
          <ErrorState
            title="Today could not be loaded"
            body="Your blocks are safe on the server. This is a connection problem, not lost work."
            detail={error}
            onRetry={reload}
            retrying={status === 'loading'}
          />
        </Card>
      ) : blocks.length === 0 ? (
        <Card>
          <EmptyState
            icon="calendarPlus"
            title="Nothing is on today"
            body="Your rhythms put training on the days you train. Everything else you put here yourself. Open the timetable and give the first hour a name."
            action={{ label: 'Open the timetable', icon: 'timetable', href: '/timetable' }}
          />
        </Card>
      ) : (
        <ol className="cd-spine list-none" aria-label="The day">
          {blocks.map((block, i) => {
            const prev = blocks[i - 1];
            const showNow =
              nowMin != null && nowMin < block.startMin && (!prev || nowMin >= prev.endMin);

            return (
              <Fragment key={block.id}>
                {showNow ? (
                  <li className="cd-nowmark">
                    <span className="cd-nowmark__time">{hhmm(nowMin)}</span>
                    <span className="cd-nowmark__rule" />
                    <span className="sr-only">is the time now</span>
                  </li>
                ) : null}
                <SpineRow
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
        <section className="cd-strip" aria-label="Habits">
          <HabitStrip label="Salah" habits={prayers} checked={checked} onToggle={toggle} />
          <HabitStrip label="Discipline" habits={others} checked={checked} onToggle={toggle} />
          {habits.length === 0 ? (
            <p className="text-caption text-ink-muted">
              No habits yet. <Link href="/settings">Add them in settings.</Link>
            </p>
          ) : null}
        </section>
      ) : (
        <Skeleton height="7rem" rounded="card" />
      )}
    </Page>
  );
}

export default TodayScreen;
