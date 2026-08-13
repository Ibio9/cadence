'use client';

/**
 * Focus.
 *
 * One block, alone. A real route (/focus/<id>), so it is linkable,
 * bookmarkable and survives a refresh: the clock's state lives on the server,
 * and everything typed here saves back to the same record.
 *
 * No shell and no cards. The rail from Today comes with the block and turns
 * horizontal at the top of the screen, where it becomes the session's own
 * progress track — the same object, zoomed in. It is the only thing here that
 * emits, and only while the clock is genuinely running.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fmtClock, fmtDur, fmtMins, hhmm } from '../../lib/api';
import Icon from '../components/Icon';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  Skeleton,
  Spinner,
  Textarea,
  useToast,
} from '../components/ui';
import Curve from '../components/Curve';
import { agoLabel, halfLifeLabel, standingOf } from '../lib/retention';
import { playOpen } from '../lib/openBlock';
import { proposeObjectives } from '../lib/proposals';
import { formatDayLabel } from '../lib/useDay';
import { isRunning, sessionPlan, useAutosave, useBlock, useElapsed } from '../lib/session';

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function FocusSkeleton() {
  return (
    <div className="cd-focus">
      <div className="cd-focus__bar">
        <Skeleton width="6rem" height="1rem" rounded="pill" />
      </div>
      <div className="cd-sessionrail" />
      <div className="flex flex-col gap-3">
        <Skeleton width="8rem" height="0.75rem" rounded="pill" />
        <Skeleton width="min(24rem, 85%)" height="2.6rem" rounded="pill" />
      </div>
      <div className="cd-focus__grid">
        <div className="flex flex-col gap-6">
          <Skeleton height="5rem" rounded="card" />
          <Skeleton height="9rem" rounded="card" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton height="7rem" rounded="card" />
          <Skeleton height="12rem" rounded="card" />
        </div>
      </div>
    </div>
  );
}

function FocusShell({ children }) {
  return (
    <div className="cd-focus">
      <div className="cd-focus__bar">
        <Link href="/" className="cd-backlink">
          <Icon name="arrowLeft" size={15} />
          <span>The day</span>
        </Link>
      </div>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function SaveMark({ state }) {
  if (state === 'idle') return null;
  if (state === 'error') {
    return (
      <span className="cd-savemark cd-savemark--error" role="alert">
        <Icon name="alertCircle" size={13} />
        Not saved. Check your connection, then type anything to try again.
      </span>
    );
  }
  return (
    <span className="cd-savemark" role="status">
      {state === 'saving' ? 'Saving' : 'Saved'}
    </span>
  );
}

/**
 * The rail, horizontal. The unfilled part is the hour ahead; the filled part
 * is what you have actually put in. It only carries light while the clock is
 * running, and it turns to the warning colour once you are past the hour you
 * gave it, because that is no longer something to celebrate.
 */
function SessionRail({ elapsed, planned, running }) {
  const progress = planned > 0 ? Math.min(1, elapsed / planned) : 0;
  const over = elapsed > planned;
  return (
    <div
      className={`cd-sessionrail${running ? ' is-running' : ''}${over ? ' is-over' : ''}`}
      style={{ '--progress': `${(progress * 100).toFixed(2)}%` }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.round(planned / 60)}
      aria-valuenow={Math.round(elapsed / 60)}
      aria-valuetext={`${fmtDur(Math.round(elapsed / 60))} of ${fmtDur(Math.round(planned / 60))}`}
      aria-label="Time on this block"
    >
      <span className={running ? 'cd-sessionrail__fill' : 'cd-sessionrail__fill'} />
      <span className={running ? 'cd-sessionrail__bead cd-breathes' : 'cd-sessionrail__bead'} />
    </div>
  );
}

/** The clock. Elapsed against the block's planned length, and the three verbs. */
function Clock({ block, elapsed, onAct, busy }) {
  const running = isRunning(block);
  const planned = (block.endMin - block.startMin) * 60;
  const over = elapsed - planned;
  const held = block.status === 'done';

  return (
    <section className="cd-clock" aria-labelledby="clock-heading">
      <h2 id="clock-heading" className="cd-eyebrow">
        Elapsed
      </h2>

      <p className={running ? 'cd-clock__value is-running' : 'cd-clock__value'}>
        <time dateTime={`PT${Math.floor(elapsed)}S`}>{fmtClock(elapsed)}</time>
      </p>

      <p className="cd-clock__against">
        {held
          ? `Held. ${fmtDur(Math.max(1, Math.round(elapsed / 60)))} on the clock.`
          : over > 60
            ? `${fmtDur(Math.round(over / 60))} past the hour you gave it.`
            : `of ${fmtDur(planned / 60)} planned.`}
      </p>

      <div className="cd-clock__actions">
        {held ? (
          <Button variant="secondary" icon="refresh" loading={busy === 'reopen'} onClick={() => onAct('reopen')}>
            Reopen
          </Button>
        ) : (
          <>
            <Button
              variant={running ? 'secondary' : 'go'}
              icon={running ? 'pause' : 'play'}
              loading={busy === 'start' || busy === 'pause'}
              onClick={() => onAct(running ? 'pause' : 'start')}
            >
              {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
            </Button>
            <Button variant="tertiary" loading={busy === 'done'} onClick={() => onAct('done')}>
              Done
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * The one concrete line this hour is for.
 *
 * Three states, and the empty one is the interesting one: rather than a blank
 * field, it offers three objectives already written from this block's own
 * title and project. Picking one is a click; writing your own is still one
 * click away. Deciding what the hour is for should not cost ten minutes of it.
 */
function Objective({ block, project, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.objective);
  const [saving, setSaving] = useState('');

  const commit = async (value) => {
    const next = (value ?? draft).trim();
    if (!next) return;
    setSaving(next);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving('');
    }
  };

  if (block.objective && !editing) {
    return (
      <section className="cd-objective" aria-labelledby="objective-heading">
        <h2 id="objective-heading" className="cd-eyebrow">
          Objective
        </h2>
        <p className="cd-objective__line">{block.objective}</p>
        <button
          type="button"
          className="cd-textlink"
          onClick={() => {
            setDraft(block.objective);
            setEditing(true);
          }}
        >
          Change
        </button>
      </section>
    );
  }

  if (editing) {
    return (
      <section className="cd-objective" aria-labelledby="objective-heading">
        <h2 id="objective-heading" className="cd-eyebrow">
          Objective
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="What this hour is for"
            autoFocus
            placeholder="Finish the 2019 paper, section B"
            wrapperClassName="flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape' && block.objective) {
                setDraft(block.objective);
                setEditing(false);
              }
            }}
          />
          <Button loading={Boolean(saving)} disabled={!draft.trim()} onClick={() => commit()}>
            Set
          </Button>
        </div>
        {block.objective ? (
          <button type="button" className="cd-textlink" onClick={() => setEditing(false)}>
            Keep the old one
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="cd-objective" aria-labelledby="objective-heading">
      <h2 id="objective-heading" className="cd-eyebrow">
        Objective
      </h2>
      <p className="cd-objective__ask">Pick what this hour is for.</p>
      <ul className="cd-proposals list-none">
        {proposeObjectives(block, project).map((text) => (
          <li key={text}>
            <button
              type="button"
              className="cd-proposal"
              disabled={Boolean(saving)}
              aria-busy={saving === text || undefined}
              onClick={() => commit(text)}
            >
              <span className="cd-proposal__text">{text}</span>
              {saving === text ? <Spinner size="sm" label="Setting" /> : <Icon name="arrowRight" size={15} />}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="cd-textlink"
        onClick={() => {
          setDraft('');
          setEditing(true);
        }}
      >
        Write my own
      </button>
    </section>
  );
}

/**
 * How long since you last did this, and the shape of what has happened since.
 *
 * One line and one sentence. It is here because the single most useful fact
 * when you sit down to an hour is whether you are continuing something or
 * restarting it, and that is a fact about the calendar rather than about the
 * block — nothing else on this screen knows it.
 */
function Retention({ retention }) {
  if (!retention || retention.sessions < 1) return null;
  const s = standingOf(retention.strength);
  const half = halfLifeLabel(retention.half);

  return (
    <section className="cd-retain" aria-labelledby="retain-heading">
      <h2 id="retain-heading" className="cd-eyebrow">
        Since last time
      </h2>
      <p className="cd-retain__line">
        You last did this <strong>{agoLabel(retention.daysSince)}</strong>
        {retention.sessions > 1 ? `, over ${retention.sessions} sessions` : ''}.
      </p>
      <Curve topic={retention} width={260} height={54} lit={s.tone === 'danger'} />
      <p className="cd-retain__note">
        {s.tone === 'danger'
          ? 'It has gone cold. Budget the first ten minutes for getting back in.'
          : s.tone === 'warning'
            ? 'Slipping. This is the session that saves the ones before it.'
            : half
              ? `Still holding — half gone in ${half}.`
              : 'Still holding.'}
      </p>
    </section>
  );
}

/** How the block's minutes are meant to go. Derived from its length, not fetched. */
function Plan({ block }) {
  return (
    <section className="cd-plan" aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="cd-eyebrow">
        The hour
      </h2>
      <ol className="cd-plan__list list-none">
        {sessionPlan(block).map((stage) => (
          <li key={stage.label} className="cd-plan__stage">
            <span className="cd-plan__time">{hhmm(stage.from)}</span>
            <span className="cd-plan__label">{stage.label}</span>
            <span className="cd-plan__mins">{fmtMins(stage.mins)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function FocusScreen({ id }) {
  const { toast } = useToast();
  const { block, status, error, reload, patch, act } = useBlock(id);
  const [busy, setBusy] = useState('');
  const root = useRef(null);
  const played = useRef(false);

  const saveMaterial = useCallback((value) => patch({ material: value }), [patch]);
  const saveNotes = useCallback((value) => patch({ notes: value }), [patch]);

  const material = useAutosave(block?.material, saveMaterial);
  const notes = useAutosave(block?.notes, saveNotes);
  const elapsed = useElapsed(block);

  // Play the block into place once, after the real content is on screen, so
  // the finish position is measured rather than guessed.
  useEffect(() => {
    if (!block || played.current) return;
    played.current = true;
    playOpen(root.current);
  }, [block]);

  const onAct = async (action) => {
    setBusy(action);
    try {
      await act(action);
      if (action === 'done') toast({ tone: 'success', title: 'Held', description: 'Nothing more is owed to this hour.' });
    } catch {
      toast({
        tone: 'danger',
        title: 'The clock did not move',
        description: 'The server did not answer. Every minute you have banked is still on it. Press it again.',
      });
    }
    setBusy('');
  };

  if (status === 'loading' && !block) return <FocusSkeleton />;

  if (status === 'missing') {
    return (
      <FocusShell>
        <ErrorState
          title="That block is gone"
          body="It was deleted, or this link points somewhere that has moved. Open the day and pick a block from there."
          action={{ label: 'Open the day', href: '/' }}
        />
      </FocusShell>
    );
  }

  if (status === 'error' && !block) {
    return (
      <FocusShell>
        <ErrorState
          title="This block did not load"
          body="The server did not answer. Your notes and your time are on it, so nothing is lost. Check your connection and try again."
          detail={error}
          onRetry={reload}
          retrying={status === 'loading'}
        />
      </FocusShell>
    );
  }

  const planned = block.endMin - block.startMin;

  return (
    <div className="cd-focus" ref={root}>
      <div className="cd-focus__bar">
        <Link href="/" className="cd-backlink">
          <Icon name="arrowLeft" size={15} />
          <span>The day</span>
        </Link>
        <span className="cd-focus__where">
          {block.project?.name}
          <span aria-hidden="true"> · </span>
          {formatDayLabel(block.date)}
        </span>
      </div>

      <SessionRail elapsed={elapsed} planned={planned * 60} running={isRunning(block)} />

      <header className="cd-focus__head">
        <p className="cd-focus__when">
          <span className="cd-focus__window">
            {hhmm(block.startMin)}–{hhmm(block.endMin)} · {fmtDur(planned)}
          </span>
          {block.status === 'done' ? <Badge tone="success">Held</Badge> : null}
          {block.status === 'missed' ? <Badge tone="warning">Missed</Badge> : null}
        </p>
        <h1 className="cd-focus__title">{block.title}</h1>
      </header>

      <div className="cd-focus__grid">
        <div className="cd-focus__col">
          <Objective block={block} project={block.project} onSave={(objective) => patch({ objective })} />
          <Retention retention={block.retention} />
          <Plan block={block} />
        </div>

        <div className="cd-focus__col">
          <Clock block={block} elapsed={elapsed} onAct={onAct} busy={busy} />

          <section className="cd-pane" aria-labelledby="material-heading">
            <h2 id="material-heading" className="cd-eyebrow">
              Working from
            </h2>
            <Input
              label="What is in front of you"
              hideLabel
              placeholder="Chapter 7, questions 1 to 20"
              value={material.value}
              onChange={(e) => material.change(e.target.value)}
              onBlur={material.flush}
            />
            <SaveMark state={material.state} />
          </section>

          <section className="cd-pane cd-pane--grow" aria-labelledby="notes-heading">
            <h2 id="notes-heading" className="cd-eyebrow">
              Notes
            </h2>
            <Textarea
              label="Notes"
              hideLabel
              rows={9}
              placeholder="What you worked out, where you got stuck, where to pick up."
              value={notes.value}
              onChange={(e) => notes.change(e.target.value)}
              onBlur={notes.flush}
            />
            <SaveMark state={notes.state} />
          </section>
        </div>
      </div>
    </div>
  );
}

export default FocusScreen;
