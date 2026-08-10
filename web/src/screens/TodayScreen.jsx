'use client';

/**
 * Today.
 *
 * The daily brief and the discipline checklist. States built in one pass:
 * loading (skeletons in the real shape), error (the brief failed, the
 * checklist still works), partial (checklist from local state, brief marked
 * unavailable), empty (no habits) and the happy path.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import Icon from '../components/Icon';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDivider,
  Checkbox,
  EmptyState,
  IconButton,
  InlineError,
  Input,
  PageHeading,
  ProgressRing,
  Skeleton,
  useToast,
} from '../components/ui';
import { formatDateLong, getGreeting, ls, parseJarvisReply } from '../lib/store';

const BRIEF_PROMPT =
  "Give me one sharp, specific sentence about what Ibrahim should focus on most today. No preamble, just the sentence.";

const BRIEF_FALLBACK = 'Stay focused on what matters, TARA and StudentSolve, in that order.';

/* -------------------------------------------------------------------------- */
/* Loading state                                                              */
/* -------------------------------------------------------------------------- */

function TodaySkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="7rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(22rem, 90%)" height="2.4rem" rounded="pill" />
        <Skeleton width="min(34rem, 100%)" height="0.9rem" rounded="pill" />
      </div>
      <Card>
        <CardBody className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height="46px" rounded="card" />
          ))}
        </CardBody>
      </Card>
    </Page>
  );
}

/* -------------------------------------------------------------------------- */
/* Habit row                                                                  */
/* -------------------------------------------------------------------------- */

function HabitRow({ habit, done, streak, onToggle, onRename, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(habit.label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next) onRename(habit.id, next);
    else setDraft(habit.label);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="cd-habit py-2">
        <Input
          ref={inputRef}
          label={`Rename ${habit.label}`}
          wrapperClassName="flex-1 min-w-0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(habit.label);
              setEditing(false);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className={done ? 'cd-habit is-done' : 'cd-habit'}>
      <Checkbox
        className="cd-habit__choice"
        label={habit.label}
        checked={done}
        onChange={() => onToggle(habit.id)}
      />
      <div className="cd-habit__actions">
        {streak > 1 ? (
          <Badge tone="neutral" icon="flame" mono>
            {streak}d
          </Badge>
        ) : null}
        <IconButton size="sm" icon="edit" label={`Rename ${habit.label}`} onClick={() => setEditing(true)} />
        {habit.id.startsWith('custom_') ? (
          <IconButton
            size="sm"
            variant="danger"
            icon="trash"
            label={`Remove ${habit.label}`}
            onClick={() => onRemove(habit.id)}
          />
        ) : null}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function TodayScreen({ ready, checklistState, setChecklistState, todayKey }) {
  const { toast } = useToast();
  const [brief, setBrief] = useState('');
  const [briefStatus, setBriefStatus] = useState('loading'); // loading | ready | error
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newError, setNewError] = useState('');
  const addRef = useRef(null);

  const { habits, checked } = checklistState;

  const loadBrief = useCallback(() => {
    if (!todayKey) return;
    setBriefStatus('loading');
    api
      .jarvis(BRIEF_PROMPT, todayKey)
      .then((r) => {
        setBrief(parseJarvisReply(r));
        setBriefStatus('ready');
      })
      .catch(() => {
        setBrief(BRIEF_FALLBACK);
        setBriefStatus('error');
      });
  }, [todayKey]);

  useEffect(() => {
    loadBrief();
  }, [loadBrief]);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  const saveState = useCallback(
    (next) => {
      setChecklistState(next);
      ls.set('cadence_checklist_' + todayKey, next);
    },
    [todayKey, setChecklistState],
  );

  const toggle = useCallback(
    (id) => {
      const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
      const streaks = ls.get('cadence_streaks', {});
      if (!checked.includes(id)) streaks[id] = (streaks[id] || 0) + 1;
      else streaks[id] = Math.max(0, (streaks[id] || 1) - 1);
      ls.set('cadence_streaks', streaks);
      saveState({ ...checklistState, checked: next });
    },
    [checked, checklistState, saveState],
  );

  const rename = useCallback(
    (id, label) => {
      saveState({ ...checklistState, habits: habits.map((h) => (h.id === id ? { ...h, label } : h)) });
    },
    [checklistState, habits, saveState],
  );

  const remove = useCallback(
    (id) => {
      const habit = habits.find((h) => h.id === id);
      saveState({
        ...checklistState,
        habits: habits.filter((h) => h.id !== id),
        checked: checked.filter((c) => c !== id),
      });
      toast({ title: 'Habit removed', description: habit ? habit.label : undefined });
    },
    [checklistState, habits, checked, saveState, toast],
  );

  const addHabit = () => {
    const label = newLabel.trim();
    if (!label) {
      setNewError('Give the habit a name so you can recognise it tomorrow.');
      return;
    }
    saveState({ ...checklistState, habits: [...habits, { id: 'custom_' + Date.now(), label, prayer: false }] });
    setNewLabel('');
    setNewError('');
    setAdding(false);
  };

  const streaks = ls.get('cadence_streaks', {});
  const prayers = useMemo(() => habits.filter((h) => h.prayer), [habits]);
  const others = useMemo(() => habits.filter((h) => !h.prayer), [habits]);
  const prayersDone = prayers.filter((h) => checked.includes(h.id)).length;
  const pct = habits.length ? Math.round((checked.length / habits.length) * 100) : 0;

  if (!ready) return <TodaySkeleton />;

  const renderGroup = (list) => (
    <ul className="flex flex-col gap-2 list-none">
      {list.map((h) => (
        <HabitRow
          key={h.id}
          habit={h}
          done={checked.includes(h.id)}
          streak={streaks[h.id] || 0}
          onToggle={toggle}
          onRename={rename}
          onRemove={remove}
        />
      ))}
    </ul>
  );

  return (
    <Page>
      <PageHeading
        eyebrow={formatDateLong()}
        title={`${getGreeting()}, Ibrahim.`}
        accent={briefStatus === 'error' ? null : brief}
        accentLoading={briefStatus === 'loading'}
        accentError={briefStatus === 'error' ? BRIEF_FALLBACK : null}
        actions={
          <div className="flex items-center gap-4">
            <ProgressRing value={pct} label={`${pct} percent of today held`} />
            <div className="flex flex-col">
              <span className="font-mono text-sm text-ink">
                {checked.length}/{habits.length}
              </span>
              <span className="text-caption text-ink-muted">held today</span>
            </div>
          </div>
        }
      />

      {/* Partial: the checklist is real and usable, the brief is not. */}
      {briefStatus === 'error' ? (
        <InlineError onRetry={loadBrief} retryLabel="Retry brief">
          Jarvis did not answer, so today's brief is a standing reminder rather than a fresh one. Your checklist below
          is unaffected.
        </InlineError>
      ) : null}

      {habits.length === 0 ? (
        <Card>
          <EmptyState
            icon="target"
            title="Start with one thing you will hold"
            body="A checklist is easier to keep than a plan. Add the first habit and the rest can follow tomorrow."
            action={{ label: 'Add a habit', icon: 'plus', onClick: () => setAdding(true) }}
          />
          {adding ? (
            <CardBody className="pt-0">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Input
                  ref={addRef}
                  label="Habit name"
                  placeholder="Read 30 pages"
                  wrapperClassName="flex-1"
                  value={newLabel}
                  error={newError}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addHabit();
                    if (e.key === 'Escape') setAdding(false);
                  }}
                />
                <Button onClick={addHabit}>Add habit</Button>
              </div>
            </CardBody>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardBody className="flex flex-col gap-6">
            {prayers.length > 0 ? (
              <section aria-labelledby="group-salah">
                <div className="flex items-center gap-3 mb-3">
                  <h2 id="group-salah" className="text-eyebrow text-ink-subtle">
                    Salah
                  </h2>
                  <span className="font-mono text-caption text-ink-muted">
                    {prayersDone}/{prayers.length}
                  </span>
                  {prayersDone === prayers.length ? (
                    <Badge tone="success">All held</Badge>
                  ) : null}
                </div>
                {renderGroup(prayers)}
              </section>
            ) : null}

            {prayers.length > 0 && others.length > 0 ? <CardDivider /> : null}

            {others.length > 0 ? (
              <section aria-labelledby="group-discipline">
                <h2 id="group-discipline" className="text-eyebrow text-ink-subtle mb-3">
                  Discipline
                </h2>
                {renderGroup(others)}
              </section>
            ) : null}

            {adding ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Input
                  ref={addRef}
                  label="Habit name"
                  placeholder="Read 30 pages"
                  wrapperClassName="flex-1"
                  value={newLabel}
                  error={newError}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addHabit();
                    if (e.key === 'Escape') setAdding(false);
                  }}
                />
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addHabit}>Add</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" icon="plus" className="self-start" onClick={() => setAdding(true)}>
                Add habit
              </Button>
            )}
          </CardBody>
        </Card>
      )}

      <p className="flex items-center gap-2 text-caption text-ink-subtle">
        <Icon name="keyboard" size={14} />
        Tab through the list, Space to tick, Enter to rename.
      </p>
    </Page>
  );
}

export default TodayScreen;
