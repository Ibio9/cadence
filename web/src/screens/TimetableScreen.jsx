'use client';

/**
 * Timetable.
 *
 * The day as it exists in the database: blocks materialised from the rhythms,
 * ordered by start time, coloured by project. Nothing here is held in local
 * storage, and nothing is invented on the client.
 *
 * Rows are not interactive yet. The Focus route they open lands in the next
 * step; until then this screen's only job is to show what is really there.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { fmtDur, hhmm, todayKey } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import Icon from '../components/Icon';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  ErrorState,
  IconButton,
  PageHeading,
  Skeleton,
} from '../components/ui';
import { formatDayLabel, shiftDay, useDay } from '../lib/useDay';

function TimetableSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="9rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(20rem, 80%)" height="2.4rem" rounded="pill" />
      </div>
      <Card>
        <CardBody className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height="64px" rounded="control" />
          ))}
        </CardBody>
      </Card>
    </Page>
  );
}

function BlockRow({ block, project, isNow }) {
  return (
    <li
      className={isNow ? 'cd-blockrow is-now' : 'cd-blockrow'}
      /* Project colour is data from the database, not a design token, so it
         arrives as a custom property and the styling stays in CSS. */
      style={project?.color ? { '--block-colour': project.color } : undefined}
    >
      <div className="cd-blockrow__time">
        <span className="cd-blockrow__start">{hhmm(block.startMin)}</span>
        <span className="cd-blockrow__dur">{fmtDur(block.endMin - block.startMin)}</span>
      </div>

      <div className="cd-blockrow__body">
        <p className="cd-blockrow__title">{block.title}</p>
        <p className="cd-blockrow__meta">
          {project ? <span className="cd-blockrow__project">{project.name}</span> : null}
          {block.objective ? (
            <span className="truncate">{block.objective}</span>
          ) : (
            <span className="text-ink-subtle">No objective set</span>
          )}
        </p>
      </div>

      <div className="cd-blockrow__marks">
        {block.fixed ? <Badge tone="neutral" icon="target">Fixed</Badge> : null}
        {block.status === 'done' ? <Badge tone="success">Held</Badge> : null}
        {block.status === 'missed' ? <Badge tone="warning">Missed</Badge> : null}
      </div>
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
    const t = setInterval(tick, 60000);
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
      <IconButton
        icon="chevronLeft"
        label="Previous day"
        onClick={() => onDateChange(shiftDay(date, -1))}
      />
      <Button variant="secondary" disabled={isToday} onClick={() => onDateChange(today)}>
        Today
      </Button>
      <IconButton
        icon="chevronRight"
        label="Next day"
        onClick={() => onDateChange(shiftDay(date, 1))}
      />
    </div>
  );

  return (
    <Page>
      <PageHeading
        eyebrow={formatDayLabel(date)}
        title="Timetable"
        accent={
          blocks.length
            ? `${blocks.length} blocks, ${fmtDur(planned)} planned.`
            : 'Nothing on the day yet.'
        }
        actions={nav}
      />

      {status === 'error' ? (
        <Card>
          <ErrorState
            title="The day could not be loaded"
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
            title="This day is empty"
            body="No rhythms materialised onto this date. If the training spine should be here, run the seed on the server, then reload."
            action={{ label: 'Reload', icon: 'refresh', onClick: reload }}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="cd-blocklist list-none">
            {blocks.map((block, i) => {
              const prev = blocks[i - 1];
              const showNow =
                isToday &&
                nowMin != null &&
                nowMin < block.startMin &&
                (!prev || nowMin >= prev.endMin);
              const isNow =
                isToday && nowMin != null && nowMin >= block.startMin && nowMin < block.endMin;

              return (
                <Fragment key={block.id}>
                  {showNow ? (
                    <li className="cd-nowmark" aria-label={`Now, ${hhmm(nowMin)}`}>
                      <span className="cd-nowmark__time">{hhmm(nowMin)}</span>
                      <span className="cd-nowmark__rule" />
                    </li>
                  ) : null}
                  <BlockRow block={block} project={projectsById[block.projectId]} isNow={isNow} />
                </Fragment>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="flex items-center gap-2 text-caption text-ink-subtle">
        <Icon name="cloudOff" size={14} />
        Read directly from the database. Opening a block comes next.
      </p>
    </Page>
  );
}

export default TimetableScreen;
