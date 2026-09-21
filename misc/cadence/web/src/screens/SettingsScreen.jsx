'use client';

/**
 * Settings.
 *
 * There is no appearance section. Cadence has one substrate and one light, and
 * a toggle would only have offered a way to make it worse.
 *
 * Habits are edited here rather than on Today, because Today's job is the next
 * hour and a screen full of rename and delete controls is not that. Tick them
 * on Today; name them here.
 */

import { useEffect, useRef, useState } from 'react';
import { Page } from '../components/shell/AppShell';
import Icon from '../components/Icon';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  IconButton,
  Input,
  PageHeading,
  Table,
  useToast,
} from '../components/ui';
import { useChecklist } from '../lib/useChecklist';

const STORAGE_KEYS = [
  { key: 'cadence_checklist_<date>', holds: "One day's habits and ticks" },
  { key: 'cadence_streaks', holds: 'Run length per habit' },
  { key: 'cadence_notes', holds: 'Every note' },
  { key: 'cadence_note_cats', holds: 'Categories you added' },
  { key: 'cadence_jarvis_history', holds: 'Last 60 messages' },
];

/** One habit, renameable in place. Habits you added can also be removed. */
function HabitLine({ habit, onRename, onRemove }) {
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

  return (
    <li className="cd-habitline">
      {editing ? (
        <Input
          ref={inputRef}
          label={`Rename ${habit.label}`}
          hideLabel
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
      ) : (
        <>
          <span className="flex-1 min-w-0 text-base text-ink break-words">{habit.label}</span>
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
        </>
      )}
    </li>
  );
}

export function SettingsScreen() {
  const { toast } = useToast();
  const { habits, rename, add, remove } = useChecklist();
  const [newLabel, setNewLabel] = useState('');
  const [newError, setNewError] = useState('');

  const addHabit = () => {
    const label = newLabel.trim();
    if (!label) {
      setNewError('Type a name first — you need to recognise it tomorrow.');
      return;
    }
    add(label);
    setNewLabel('');
    setNewError('');
  };

  const removeHabit = (id) => {
    const habit = habits.find((h) => h.id === id);
    remove(id);
    toast({ title: 'Removed', description: habit?.label });
  };

  const [reducedMotion, setReducedMotion] = useState(false);
  const [apiBase, setApiBase] = useState('');

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setApiBase(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');
  }, []);

  return (
    <Page>
      <PageHeading eyebrow="Preferences" title="Settings" lead="Set it once. The whole app follows." />

      <Card as="section" aria-label="Habits">
        <CardHeader
          eyebrow="Habits"
          title="What you hold every day"
          description="These become the strip under today's blocks. Tick them there. Name them here."
        />
        <CardBody className="flex flex-col gap-5">
          {habits.length ? (
            <ul className="cd-habitlines list-none">
              {habits.map((h) => (
                <HabitLine key={h.id} habit={h} onRename={rename} onRemove={removeHabit} />
              ))}
            </ul>
          ) : (
            <p className="text-base text-ink-muted max-w-prose">
              Nothing yet. Add one you can actually hold — it beats ten you cannot.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Input
              label="Add a habit"
              placeholder="Read 30 pages"
              wrapperClassName="flex-1"
              value={newLabel}
              error={newError}
              onChange={(e) => {
                setNewLabel(e.target.value);
                if (newError) setNewError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
            />
            <Button icon="plus" onClick={addHabit}>
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card as="section" aria-label="Motion">
        <CardHeader
          eyebrow="Motion"
          title="Animation"
          description="Cadence follows your system setting. There is nothing to switch here."
        />
        <CardBody className="flex flex-col gap-3">
          <p className="flex items-center gap-3 text-sm text-ink-muted">
            <Icon name={reducedMotion ? 'checkCircle' : 'info'} size={16} />
            {reducedMotion
              ? 'Your system asks for reduced motion, so transitions are off.'
              : 'Your system allows motion, so transitions are on.'}
          </p>
          <p className="text-caption text-ink-subtle max-w-prose">
            Either way, anything that glows keeps glowing — it just stops breathing. The light carries meaning, so
            reduced motion stills it rather than removing it.
          </p>
        </CardBody>
      </Card>

      <Card as="section" aria-label="Stored data">
        <CardHeader
          eyebrow="Data"
          title="What this browser keeps"
          description="Your day, your blocks and the question bank live on the server. These five keys are local."
        />
        <CardBody className="flex flex-col gap-4">
          <Table
            caption="Local storage keys used by Cadence"
            columns={[
              { key: 'key', header: 'Key', render: (r) => <span className="font-mono text-caption">{r.key}</span> },
              { key: 'holds', header: 'Holds' },
            ]}
            rows={STORAGE_KEYS}
            getRowId={(r) => r.key}
          />
          <p className="text-caption text-ink-subtle break-words">
            API base: <span className="font-mono">{apiBase}</span>
          </p>
        </CardBody>
      </Card>

      <Card as="section" aria-label="Keyboard shortcuts">
        <CardHeader eyebrow="Keyboard" title="Shortcuts" description="Everything here also works with the mouse." />
        <CardBody>
          <Table
            caption="Keyboard shortcuts"
            columns={[
              { key: 'keys', header: 'Keys', render: (r) => <span className="font-mono text-caption">{r.keys}</span> },
              { key: 'does', header: 'Does' },
            ]}
            rows={[
              { keys: 'Tab', does: 'Move through every control in reading order' },
              { keys: 'Enter', does: 'Open the block under the cursor, or send to Jarvis' },
              { keys: 'Space', does: 'Tick a habit' },
              { keys: 'Ctrl or Cmd + Enter', does: 'Save a note from the capture box' },
              { keys: 'Escape', does: 'Close a dialog or panel' },
            ]}
            getRowId={(r) => r.keys}
          />
        </CardBody>
      </Card>
    </Page>
  );
}

export default SettingsScreen;
