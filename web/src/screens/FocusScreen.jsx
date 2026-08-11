'use client';

/**
 * Focus.
 *
 * One block, alone on the screen. It is a real route (/focus/<id>), so it is
 * linkable, bookmarkable and survives a refresh: the clock's state lives on the
 * server, and everything typed here saves back to the same record.
 *
 * There is no shell around it on purpose. The one job of this screen is to make
 * the next hour the only thing you can see.
 */

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { fmtClock, fmtDur, hhmm } from '../../lib/api';
import Icon from '../components/Icon';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  Skeleton,
  Textarea,
  useToast,
} from '../components/ui';
import { formatDayLabel } from '../lib/useDay';
import { isRunning, sessionPlan, useAutosave, useBlock, useElapsed } from '../lib/session';

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function FocusSkeleton() {
  return (
    <div className="cd-focus">
      <div className="cd-focus__bar">
        <Skeleton width="7rem" height="1rem" rounded="pill" />
      </div>
      <div className="cd-focus__grid">
        <div className="flex flex-col gap-6">
          <Skeleton width="9rem" height="0.75rem" rounded="pill" />
          <Skeleton width="min(26rem, 90%)" height="3rem" rounded="pill" />
          <Skeleton height="7rem" rounded="card" />
          <Skeleton height="11rem" rounded="card" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton height="13rem" rounded="card" />
          <Skeleton height="15rem" rounded="card" />
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
          <Icon name="arrowLeft" size={16} />
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
      <span className="cd-savemark cd-savemark--error">
        <Icon name="alertCircle" size={13} />
        Not saved. Check your connection and type again.
      </span>
    );
  }
  return <span className="cd-savemark">{state === 'saving' ? 'Saving' : 'Saved'}</span>;
}

/** The clock. Elapsed against the block's planned length, and the three verbs. */
function Clock({ block, onAct, busy }) {
  const elapsed = useElapsed(block);
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
          ? `Held. ${fmtDur(Math.round(elapsed / 60))} on the clock.`
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
              icon={running ? 'pause' : 'play'}
              loading={busy === 'start' || busy === 'pause'}
              onClick={() => onAct(running ? 'pause' : 'start')}
            >
              {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
            </Button>
            <Button variant="secondary" icon="check" loading={busy === 'done'} onClick={() => onAct('done')}>
              Done
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/** The one concrete line this hour is for. */
function Objective({ block, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(block.objective);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    const next = draft.trim();
    if (!next) return;
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!block.objective || editing) {
    return (
      <section className="cd-objective" aria-labelledby="objective-heading">
        <h2 id="objective-heading" className="cd-eyebrow">
          Objective
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="What this hour is for"
            placeholder="Finish the 2019 paper, section B"
            autoFocus
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
          <Button loading={saving} disabled={!draft.trim()} onClick={commit}>
            Set
          </Button>
        </div>
      </section>
    );
  }

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
        Change it
      </button>
    </section>
  );
}

/** How the block's minutes are meant to go. Derived from its length, not fetched. */
function Plan({ block }) {
  const stages = sessionPlan(block);
  return (
    <section className="cd-plan" aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="cd-eyebrow">
        The hour
      </h2>
      <ol className="cd-plan__list list-none">
        {stages.map((stage) => (
          <li key={stage.label} className="cd-plan__stage">
            <span className="cd-plan__time">{hhmm(stage.from)}</span>
            <span className="cd-plan__label">{stage.label}</span>
            <span className="cd-plan__mins">{fmtDur(stage.mins)}</span>
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

  const saveMaterial = useCallback((value) => patch({ material: value }), [patch]);
  const saveNotes = useCallback((value) => patch({ notes: value }), [patch]);

  const material = useAutosave(block?.material, saveMaterial);
  const notes = useAutosave(block?.notes, saveNotes);

  const onAct = async (action) => {
    setBusy(action);
    try {
      await act(action);
      if (action === 'done') toast({ tone: 'success', title: 'Held', description: 'The block is closed.' });
    } catch {
      toast({
        tone: 'danger',
        title: 'The clock did not change',
        description: 'The server did not answer. Your time so far is still saved on it.',
      });
    }
    setBusy('');
  };

  if (status === 'loading' && !block) return <FocusSkeleton />;

  if (status === 'missing') {
    return (
      <FocusShell>
        <ErrorState
          title="This block is not on any day"
          body="It was deleted, or the link points at something that has moved. Open the day and pick a block from there."
          action={{ label: 'Open the day', href: '/' }}
        />
      </FocusShell>
    );
  }

  if (status === 'error' && !block) {
    return (
      <FocusShell>
        <ErrorState
          title="The block could not be loaded"
          body="Your work is safe on the server. This is a connection problem, not lost time."
          detail={error}
          onRetry={reload}
          retrying={status === 'loading'}
        />
      </FocusShell>
    );
  }

  const planned = block.endMin - block.startMin;

  return (
    <div className="cd-focus">
      <div className="cd-focus__bar">
        <Link href="/" className="cd-backlink">
          <Icon name="arrowLeft" size={16} />
          <span>The day</span>
        </Link>
        <span className="cd-focus__where">
          {block.project?.name}
          <span aria-hidden="true"> · </span>
          {formatDayLabel(block.date)}
        </span>
      </div>

      <header className="cd-focus__head">
        <p className="cd-focus__when">
          <span className="cd-focus__window">
            {hhmm(block.startMin)}–{hhmm(block.endMin)}
          </span>
          <span className="cd-focus__length">{fmtDur(planned)}</span>
          {block.status === 'done' ? <Badge tone="success" icon="checkCircle">Held</Badge> : null}
          {block.status === 'missed' ? <Badge tone="warning" icon="alertTriangle">Missed</Badge> : null}
        </p>
        <h1 className="cd-focus__title">{block.title}</h1>
      </header>

      <div className="cd-focus__grid">
        <div className="cd-focus__col">
          <Objective block={block} onSave={(objective) => patch({ objective })} />
          <Plan block={block} />
        </div>

        <div className="cd-focus__col">
          <Clock block={block} onAct={onAct} busy={busy} />

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
              label="Session notes"
              hideLabel
              rows={10}
              placeholder="What you worked out, what you got stuck on, where to pick up."
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
