'use client';

/**
 * Notes.
 *
 * Capture card, category filter, search, masonry list and an editor sheet.
 * A note filed under To Do is handed to Jarvis to be placed on today's
 * timetable, and the result is reported in a toast either way.
 *
 * Categories no longer carry their own hue. Blue is the only accent in this
 * design language, so a category is told apart by its name in a neutral badge.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { Page } from '../components/shell/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  IconButton,
  Input,
  PageHeading,
  PartialNotice,
  Select,
  Sheet,
  Skeleton,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui';
import { ls, NOTE_CATEGORIES } from '../lib/store';

function NotesSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="5rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(18rem, 80%)" height="2.4rem" rounded="pill" />
      </div>
      <Skeleton height="12rem" rounded="card" />
      <div className="cd-notegrid">
        {[10, 7, 12, 8].map((h, i) => (
          <Skeleton key={i} height={`${h}rem`} rounded="card" className="mb-4" />
        ))}
      </div>
    </Page>
  );
}

export function NotesScreen({ ready, todayKey }) {
  const { toast } = useToast();

  const [notes, setNotes] = useState([]);
  const [customCats, setCustomCats] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [capturing, setCapturing] = useState('');
  const [capCat, setCapCat] = useState('Ideas');
  const [captureError, setCaptureError] = useState('');
  const [openId, setOpenId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [newCat, setNewCat] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [scheduleFailed, setScheduleFailed] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!ready) return;
    setNotes(ls.get('cadence_notes', []));
    setCustomCats(ls.get('cadence_note_cats', []));
  }, [ready]);

  const allCats = useMemo(() => [...NOTE_CATEGORIES, ...customCats], [customCats]);

  const saveNotes = useCallback((next) => {
    setNotes(next);
    ls.set('cadence_notes', next);
  }, []);

  const scheduleAsTask = useCallback(
    async (taskText) => {
      setScheduling(true);
      setScheduleFailed(null);
      try {
        // The server already holds today's blocks, the open gaps and the real
        // project ids, and applies any block Jarvis returns. The client no
        // longer keeps its own copy of the day or decides the placement.
        const msg = `Add this to today as a block, in an open gap that fits it: "${taskText}"`;
        const result = await api.jarvis(msg, todayKey);

        if ((result?.applied ?? 0) > 0) {
          toast({
            tone: 'success',
            title: 'Placed on today',
            description: 'Open the timetable to see where it landed.',
          });
        } else {
          setScheduleFailed(taskText);
          toast({
            tone: 'warning',
            title: 'Saved, but not scheduled',
            description: 'Jarvis did not place it. Add it to the timetable yourself.',
            action: { label: 'Try again', onClick: () => scheduleAsTask(taskText) },
          });
        }
      } catch {
        setScheduleFailed(taskText);
        toast({
          tone: 'danger',
          title: 'Saved, but not scheduled',
          description: 'Jarvis is not reachable. Your note is safe.',
          action: { label: 'Try again', onClick: () => scheduleAsTask(taskText) },
        });
      }
      setScheduling(false);
    },
    [todayKey, toast],
  );

  const addNote = async () => {
    const text = capturing.trim();
    if (!text) {
      setCaptureError('Write something first, even a fragment.');
      return;
    }
    setCaptureError('');
    const note = {
      id: Date.now(),
      title: text.split('\n')[0].slice(0, 80),
      body: text,
      category: capCat,
      ts: Date.now(),
    };
    saveNotes([note, ...notes]);
    setCapturing('');
    if (capCat === 'To Do') await scheduleAsTask(text);
    else toast({ tone: 'success', title: 'Note saved', description: capCat });
  };

  const deleteNote = (id) => {
    saveNotes(notes.filter((n) => n.id !== id));
    if (openId === id) setOpenId(null);
    toast({ title: 'Note deleted' });
  };

  const openNote = (note) => {
    setOpenId(note.id);
    setEditBody(note.body);
  };

  const handleEdit = (val) => {
    setEditBody(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNotes(
        notes.map((n) => (n.id === openId ? { ...n, body: val, title: val.split('\n')[0].slice(0, 80) } : n)),
      );
    }, 600);
  };

  const addCat = () => {
    const c = newCat.trim();
    if (!c || allCats.includes(c)) return;
    const next = [...customCats, c];
    setCustomCats(next);
    ls.set('cadence_note_cats', next);
    setNewCat('');
  };

  const filtered = useMemo(
    () =>
      notes.filter((n) => {
        const matchCat = catFilter === 'All' || n.category === catFilter;
        const matchSearch = !search || n.body.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
      }),
    [notes, catFilter, search],
  );

  const openNoteRecord = notes.find((n) => n.id === openId);

  if (!ready) return <NotesSkeleton />;

  return (
    <Page>
      <PageHeading
        eyebrow="Capture"
        title="Notes"
        accent="Get it out of your head first. Sort it after."
      />

      {/* Capture */}
      <Card>
        <CardBody className="flex flex-col gap-4">
          <Textarea
            label="New note"
            placeholder="What is on your mind?"
            rows={4}
            value={capturing}
            error={captureError}
            helper="Ctrl or Cmd plus Enter saves."
            onChange={(e) => {
              setCapturing(e.target.value);
              if (captureError) setCaptureError('');
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addNote();
            }}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label="Category"
              wrapperClassName="flex-1"
              value={capCat}
              options={allCats}
              onChange={(e) => setCapCat(e.target.value)}
            />
            <Button icon="plus" loading={scheduling} onClick={addNote}>
              Save note
            </Button>
          </div>
          {capCat === 'To Do' ? (
            <p className="text-caption text-ink-muted">
              Notes filed under To Do are sent to Jarvis and placed on today&apos;s timetable.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Partial: notes saved, scheduling did not complete */}
      {scheduleFailed ? (
        <PartialNotice>
          Your note is saved. Jarvis could not place it on the timetable, so add it yourself when you know the hour.
        </PartialNotice>
      ) : null}

      {/* Filter and search */}
      <Card variant="flat">
        <CardBody className="flex flex-col gap-4">
          <Input
            label="Search notes"
            iconStart="search"
            placeholder="Search the text of every note"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex flex-col gap-3">
            <Tabs
              variant="pill"
              label="Filter by category"
              value={catFilter}
              onChange={setCatFilter}
              items={['All', ...allCats].map((c) => ({
                value: c,
                label: c,
                count: c === 'All' ? notes.length : notes.filter((n) => n.category === c).length,
              }))}
              className="flex-wrap"
            />
            <div className="flex items-end gap-2">
              <Input
                label="New category"
                wrapperClassName="max-w-sm flex-1"
                placeholder="Name it"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCat()}
              />
              <Button variant="secondary" icon="plus" onClick={addCat}>
                Add
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          {notes.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="Nothing captured yet"
              body="Notes work best when they cost nothing to write. Put the first thought in the box above and file it later."
            />
          ) : (
            <EmptyState
              icon="search"
              title="No notes match that"
              body="Try a shorter search, or clear the category filter to see everything again."
              action={{
                label: 'Clear filters',
                icon: 'refresh',
                onClick: () => {
                  setSearch('');
                  setCatFilter('All');
                },
              }}
            />
          )}
        </Card>
      ) : (
        <div className="cd-notegrid cd-notegrid--wide">
          {filtered.map((n) => (
            <article key={n.id} className={openId === n.id ? 'cd-note is-open' : 'cd-note'}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <Badge tone="neutral" icon={null}>
                  {n.category}
                </Badge>
                <div className="flex items-center gap-1 shrink-0">
                  <time className="font-mono text-caption text-ink-subtle" dateTime={new Date(n.ts).toISOString()}>
                    {new Date(n.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                  </time>
                  <IconButton size="sm" icon="trash" variant="danger" label={`Delete note ${n.title}`} onClick={() => deleteNote(n.id)} />
                </div>
              </div>
              <button type="button" className="text-left w-full" onClick={() => openNote(n)}>
                <h3 className="text-base font-medium text-ink truncate">{n.title || 'Untitled note'}</h3>
                <p className="text-sm text-ink-muted clamp-3 mt-1">{n.body}</p>
                <span className="sr-only">Open to edit</span>
              </button>
            </article>
          ))}
        </div>
      )}

      {/* Editor */}
      <Sheet
        open={Boolean(openNoteRecord)}
        onClose={() => setOpenId(null)}
        title={openNoteRecord?.title || 'Note'}
        footer={
          <>
            <Button variant="danger" icon="trash" onClick={() => deleteNote(openId)}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setOpenId(null)}>
              Done
            </Button>
          </>
        }
      >
        {openNoteRecord ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Badge tone="neutral" icon={null}>
                {openNoteRecord.category}
              </Badge>
              <span className="text-caption text-ink-subtle">Saves as you type</span>
            </div>
            <Textarea
              label="Note body"
              data-autofocus
              rows={16}
              value={editBody}
              onChange={(e) => handleEdit(e.target.value)}
            />
          </div>
        ) : null}
      </Sheet>
    </Page>
  );
}

export default NotesScreen;
