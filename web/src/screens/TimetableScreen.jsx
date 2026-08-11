'use client';

/**
 * Timetable.
 *
 * Any day, on the same rail as Today. The one difference is the bead: it only
 * appears on the day that is actually happening, because no other day has a
 * now on it.
 *
 * Nothing here is held in local storage and nothing is invented on the client.
 */

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { fmtDur, hhmm, todayKey } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeading,
  Skeleton,
} from '../components/ui';
import Icon from '../components/Icon';
import { openBlock } from '../lib/openBlock';
import { formatDayLabel, shiftDay, useDay } from '../lib/useDay';

function TimetableSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="9rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(14rem, 60%)" height="2.4rem" rounded="pill" />
      </div>
      <div className="cd-rail">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="cd-railrow">
            <Skeleton width={i % 2 ? '50%' : '36%'} height="1.1rem" rounded="pill" />
            <Skeleton width="28%" height="0.75rem" rounded="pill" className="mt-2" />
          </div>
        ))}
      </div>
    </Page>
  );
}

function BlockRow({ block, project, isNow }) {
  return (
    <li>
      <Link
        href={`/focus/${block.id}`}
        onClick={openBlock}
        className={isNow ? 'cd-railrow is-now' : 'cd-railrow'}
        aria-current={isNow ? 'time' : undefined}
      >
        <span className="cd-railrow__time">
          {hhmm(block.startMin)}
          <span className="cd-railrow__dur">{fmtDur(block.endMin - block.startMin)}</span>
        </span>

        <span
          className="cd-railrow__tick"
          style={project?.color ? { '--tick-colour': project.color } : undefined}
        />

        <span className="cd-railrow__body">
          <span className="cd-railrow__title">{block.title}</span>
          <span className="cd-railrow__meta">
            {project ? <span className="cd-railrow__project">{project.name}</span> : null}
            <span className="truncate">{block.objective || 'No objective yet'}</span>
          </span>
        </span>

        <span className="cd-railrow__marks">
          {block.fixed ? <span className="cd-when">Fixed</span> : null}
          {block.status === 'done' ? <span className="cd-when">Held</span> : null}
          {block.status === 'missed' ? <Badge tone="warning">Missed</Badge> : null}
          <Icon name="chevronRight" size={15} className="cd-railrow__go" />
        </span>
      </Link>
    </li>
  );
}

export function TimetableScreen({ date, onDateChange }) {
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

  const today = todayKey();
  const isToday = date === today;

  const blocks = useMemo(
    () => [...(state?.blocks ?? [])].sort((a, b) => a.startMin - b.startMin),
    [state],
  );

  const projectsById = useMemo(() => {
    const map = {};
    for (const p of state?.projects ?? []) map[p.id] = p;
    return map;
  }, [state]);

  const planned = blocks.reduce((total, b) => total + (b.endMin - b.startMin), 0);

  if (status === 'loading' && !state) return <TimetableSkeleton />;

  const nav = (
    <div className="flex items-center gap-1">
      <IconButton icon="chevronLeft" label="Previous day" onClick={() => onDateChange(shiftDay(date, -1))} />
      <Button variant="secondary" disabled={isToday} onClick={() => onDateChange(today)}>
        Today
      </Button>
      <IconButton icon="chevronRight" label="Next day" onClick={() => onDateChange(shiftDay(date, 1))} />
    </div>
  );

  return (
    <Page>
      <PageHeading
        eyebrow={formatDayLabel(date)}
        title="Timetable"
        lead={blocks.length ? `${blocks.length} blocks, ${fmtDur(planned)} planned.` : undefined}
        actions={nav}
      />

      {status === 'error' ? (
        <ErrorState
          title="The day could not be loaded"
          body="Your blocks are safe on the server. This is a connection problem, not lost work."
          detail={error}
          onRetry={reload}
          retrying={status === 'loading'}
        />
      ) : blocks.length === 0 ? (
        <EmptyState
          icon="calendarPlus"
          title="This day is empty"
          body="No rhythms land on this date. Ask Jarvis to put something here, or move a block onto it from another day."
          action={{ label: 'Ask Jarvis', icon: 'jarvis', href: '/jarvis' }}
          secondaryAction={{ label: 'Reload', icon: 'refresh', onClick: reload }}
        />
      ) : (
        <ol className="cd-rail list-none" aria-label={`Blocks on ${formatDayLabel(date)}`}>
          {blocks.map((block, i) => {
            const prev = blocks[i - 1];
            const showBead =
              isToday && nowMin != null && nowMin < block.startMin && (!prev || nowMin >= prev.endMin);
            const isNow =
              isToday && nowMin != null && nowMin >= block.startMin && nowMin < block.endMin;

            return (
              <Fragment key={block.id}>
                {showBead ? (
                  <li className="cd-bead">
                    <span className="cd-bead__time">{hhmm(nowMin)}</span>
                    <span className="cd-bead__dot cd-breathes" />
                    <span className="sr-only">is the time now</span>
                  </li>
                ) : null}
                <BlockRow block={block} project={projectsById[block.projectId]} isNow={isNow} />
              </Fragment>
            );
          })}
        </ol>
      )}
    </Page>
  );
}

export default TimetableScreen;
