'use client';

/**
 * Timetable.
 *
 * The day from 06:00 to 23:00, one row an hour, editable in a modal and
 * generatable in one action. Slot types keep their names and are told apart by
 * a mono type label rather than by seven different hues.
 */

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import Icon from '../components/Icon';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  InlineError,
  Modal,
  PageHeading,
  PartialNotice,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '../components/ui';
import {
  DEFAULT_TIMETABLE_PROMPT,
  HOURS,
  RECESSIVE_SLOT_TYPES,
  SLOT_TYPES,
  fmtHHMM,
  ls,
  parseJarvisReply,
} from '../lib/store';

const ROW_H = 52;
const START_MIN = 6 * 60;
const END_MIN = 23 * 60;

function TimetableSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="6rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(20rem, 80%)" height="2.4rem" rounded="pill" />
      </div>
      <Skeleton height="10rem" rounded="card" />
      <Card>
        <div className="flex flex-col">
          {HOURS.slice(0, 10).map((h) => (
            <div key={h} className="flex items-center gap-4 px-4" style={{ height: ROW_H }}>
              <Skeleton width="2.6rem" height="0.7rem" rounded="pill" />
              <Skeleton height="1.6rem" rounded="sm" />
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

export function TimetableScreen({ ready, slots, setSlots, todayKey }) {
  const { toast } = useToast();

  const [editHour, setEditHour] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editType, setEditType] = useState('Study');
  const [editError, setEditError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genError, setGenError] = useState('');
  const [genPartial, setGenPartial] = useState(null);
  const [nowMinute, setNowMinute] = useState(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMinute(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, []);

  const saveSlots = (next) => {
    setSlots(next);
    ls.set('cadence_timetable_' + todayKey, next);
  };

  const openEdit = (hour) => {
    setEditHour(hour);
    const existing = slots[hour];
    setEditLabel(existing?.label || '');
    setEditType(existing?.type || 'Study');
    setEditError('');
  };

  const saveSlot = () => {
    if (!editLabel.trim()) {
      setEditError('Name the hour, or clear it if nothing is planned.');
      return;
    }
    saveSlots({ ...slots, [editHour]: { label: editLabel.trim(), type: editType } });
    setEditHour(null);
  };

  const clearSlot = () => {
    const next = { ...slots };
    delete next[editHour];
    saveSlots(next);
    setEditHour(null);
    toast({ title: 'Hour cleared', description: `${fmtHHMM(editHour)} is open again.` });
  };

  const generate = async () => {
    const prompt = genPrompt.trim() || DEFAULT_TIMETABLE_PROMPT;
    setGenerating(true);
    setGenError('');
    setGenPartial(null);
    try {
      // Model prompt, not UI copy. Preserved verbatim so generation behaves
      // exactly as before.
      const sys = `Create a realistic hourly schedule for Ibrahim Malik (17, Harris Westminster, A-levels Further Maths/Maths/Economics/Philosophy, building StudentSolve, TARA prep October 2026, trades MNQ futures, Muay Thai training). Produce a JSON object ONLY — no explanation, no markdown. Keys are hours as numbers (6–22), values are {"label":"...","type":"..."}. Types must be one of: Study, Build, Training, Admin, Break, Deep Work, Markets. Tasks/context: ${prompt}`;
      const result = await api.jarvis(sys, todayKey);
      const text = parseJarvisReply(result);
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON found in response');
      const parsed = JSON.parse(match[0]);

      const next = {};
      let skipped = 0;
      for (const [k, v] of Object.entries(parsed)) {
        const hour = parseInt(k, 10);
        if (hour >= 6 && hour <= 22 && v?.label) {
          next[hour] = { label: String(v.label), type: SLOT_TYPES.includes(v.type) ? v.type : 'Study' };
        } else {
          skipped += 1;
        }
      }

      saveSlots(next);
      const filled = Object.keys(next).length;
      if (filled === 0) {
        setGenError('Jarvis replied, but nothing in it was a usable hour. Try describing the day in one line.');
      } else if (skipped > 0 || filled < 6) {
        setGenPartial({ filled, skipped });
        toast({ tone: 'warning', title: 'Part of the day came back', description: `${filled} hours placed.` });
      } else {
        toast({ tone: 'success', title: 'Day generated', description: `${filled} hours placed.` });
      }
    } catch {
      setGenError('Jarvis is not reachable, so the day was not generated. Your existing hours are untouched.');
    }
    setGenerating(false);
  };

  const filledCount = Object.keys(slots).length;
  const nowHour = nowMinute == null ? null : Math.floor(nowMinute / 60);
  const inRange = nowMinute != null && nowMinute >= START_MIN && nowMinute <= END_MIN;
  const nowTop = inRange ? ((nowMinute - START_MIN) / (END_MIN - START_MIN)) * (HOURS.length * ROW_H) : 0;

  const heldSummary = useMemo(() => {
    const byType = {};
    for (const slot of Object.values(slots)) byType[slot.type] = (byType[slot.type] || 0) + 1;
    return Object.entries(byType).sort((a, b) => b[1] - a[1]);
  }, [slots]);

  if (!ready) return <TimetableSkeleton />;

  return (
    <Page>
      <PageHeading
        eyebrow="Today's plan"
        title="Timetable"
        accent="A day you can see is a day you can keep."
        actions={
          filledCount > 0 ? (
            <Badge tone="accent" icon="clock" mono>
              {filledCount} hours planned
            </Badge>
          ) : null
        }
      />

      {/* Generate */}
      <Card>
        <CardBody className="flex flex-col gap-4">
          <Textarea
            label="What needs to happen today"
            placeholder="Leave this empty to use the standing schedule."
            rows={2}
            value={genPrompt}
            disabled={generating}
            helper="Enter generates. Shift and Enter adds a line."
            onChange={(e) => setGenPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generate();
              }
            }}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {heldSummary.map(([type, count]) => (
                <Badge key={type} tone="neutral" icon={null} mono>
                  {type} {count}
                </Badge>
              ))}
            </div>
            <Button icon="sparkle" loading={generating} onClick={generate}>
              Generate schedule
            </Button>
          </div>

          {genError ? (
            <InlineError onRetry={generate} retrying={generating}>
              {genError}
            </InlineError>
          ) : null}

          {genPartial ? (
            <PartialNotice>
              {genPartial.filled} hours came back and are on the grid. {genPartial.skipped > 0
                ? `${genPartial.skipped} entries were outside 06:00 to 22:00 and were dropped. `
                : ''}
              Fill the rest by clicking any empty hour.
            </PartialNotice>
          ) : null}
        </CardBody>
      </Card>

      {/* Grid. When the day is empty the invitation stands in for it, so there
          is one clear next step rather than eighteen identical blank rows. */}
      {filledCount === 0 ? (
        <Card>
          <EmptyState
            icon="calendarPlus"
            title="The day is still open"
            body="Describe what needs to happen and Jarvis will lay out the hours, or pick a starting hour and fill it in yourself."
            action={{ label: 'Generate schedule', icon: 'sparkle', onClick: generate, loading: generating }}
            secondaryAction={{ label: 'Start at 09:00', icon: 'plus', onClick: () => openEdit(9) }}
          />
        </Card>
      ) : (
      <Card className="overflow-hidden">
        <div className="relative">
          <ul className="list-none">
            {HOURS.map((hour) => {
              const slot = slots[hour];
              const isNow = nowHour === hour;
              const recessive = slot ? RECESSIVE_SLOT_TYPES.includes(slot.type) : false;
              return (
                <li key={hour}>
                  <button
                    type="button"
                    className={isNow ? 'cd-slotrow is-now' : 'cd-slotrow'}
                    onClick={() => openEdit(hour)}
                    aria-label={
                      slot
                        ? `${fmtHHMM(hour)}, ${slot.label}, ${slot.type}. Edit this hour.`
                        : `${fmtHHMM(hour)}, empty. Add something to this hour.`
                    }
                  >
                    <span className="cd-slotrow__time">{fmtHHMM(hour)}</span>
                    <span
                      className={
                        slot
                          ? `cd-slotrow__body is-filled${recessive ? ' is-soft' : ''}`
                          : 'cd-slotrow__body'
                      }
                    >
                      {slot ? (
                        <>
                          <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{slot.label}</span>
                          <span className="font-mono text-caption text-ink-muted shrink-0">{slot.type}</span>
                        </>
                      ) : (
                        <span className="text-caption text-ink-subtle flex items-center gap-2">
                          <Icon name="plus" size={13} />
                          {isNow ? 'Now, and nothing planned' : 'Open'}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {inRange ? (
            <div className="cd-nowline" style={{ top: nowTop }} aria-hidden="true">
              <span className="cd-nowline__rule" />
              <span className="cd-nowline__dot" />
            </div>
          ) : null}
        </div>
      </Card>
      )}

      {/* Edit modal */}
      <Modal
        open={editHour !== null}
        onClose={() => setEditHour(null)}
        title={editHour !== null ? `${fmtHHMM(editHour)} to ${fmtHHMM(editHour + 1)}` : ''}
        description="One hour, one intention. Clearing it leaves the hour open."
        actions={
          <>
            {editHour !== null && slots[editHour] ? (
              <Button variant="danger" icon="trash" onClick={clearSlot}>
                Clear hour
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setEditHour(null)}>
              Cancel
            </Button>
            <Button onClick={saveSlot}>Save</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            data-autofocus
            label="What is happening"
            placeholder="TARA critical reasoning set"
            value={editLabel}
            error={editError}
            onChange={(e) => {
              setEditLabel(e.target.value);
              if (editError) setEditError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && saveSlot()}
          />
          <Select label="Type" value={editType} options={SLOT_TYPES} onChange={(e) => setEditType(e.target.value)} />
        </div>
      </Modal>
    </Page>
  );
}

export default TimetableScreen;
