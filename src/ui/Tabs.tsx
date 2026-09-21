import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, type Tab, type Todo } from '../store'
import {
  dueLabel,
  isoDay,
  parseDue,
  parseIso,
  periodsFor,
  plan,
  setOn,
  toMin,
  upcoming,
  type Block,
  type Period,
} from '../lib/schedule'
import { OPENING_BRIEFING, NEWS_BRIEFING } from '../lib/briefing'

/**
 * The three things he wants without asking for them.
 *
 * Along the top because that edge was empty and because these are standing
 * references rather than answers: the conversation happens in the middle, the
 * machine reports on itself down the sides, and this is the part of the screen
 * you look at deliberately.
 *
 * Every control here is a real <button>. The hand tracker presses whatever is
 * under the cursor by synthesising a click, so being a button is exactly what
 * makes these pinchable, and it is also what keeps them working with a mouse
 * and a keyboard without a second code path.
 *
 * Opening the tab that is already open closes it, so one finger is enough to
 * both show and dismiss.
 */

const TABS: { id: Exclude<Tab, null>; label: string }[] = [
  { id: 'timetable', label: 'TIMETABLE' },
  { id: 'todo', label: 'TO-DO' },
  { id: 'briefing', label: 'BRIEFING' },
  { id: 'news', label: 'NEWS' },
]

/* ------------------------------------------------------------------ timetable */

/** What a period is called on the timetable. */
function periodLabel(p: Period) {
  switch (p.kind) {
    case 'tutor':
      return 'tutor time'
    case 'break':
      return 'break'
    case 'lunch':
      return 'lunch'
    case 'free':
      return 'free'
    case 'lab':
      return 'lab time · to-do or TARA'
    default:
      return p.subject ?? p.kind
  }
}

const blockLength = (b: Block) => {
  const mins = toMin(b.end) - toMin(b.start)
  return mins % 60 ? `${mins} min` : `${mins / 60} hour${mins === 60 ? '' : 's'}`
}

function Timetable() {
  const todos = useStore((s) => s.todos)
  const toggle = useStore((s) => s.toggleTodo)
  // The plan is worked out from the clock, so the clock has to tick for a
  // missed block to move on while the tab is open.
  const [now, now_] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => now_(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const days = upcoming(7, now)
  const blocks = plan(todos, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  // Today open, the rest folded to what is planned in them; any can be opened.
  const [open, open_] = useState<Set<string>>(() => new Set([isoDay(new Date())]))
  const flip = (iso: string) =>
    open_((s) => {
      const next = new Set(s)
      if (next.has(iso)) next.delete(iso)
      else next.add(iso)
      return next
    })

  return (
    <div className="tabpanel-body" data-hit-rescue>
      {days.map((d) => {
        // Anything promised to this day, plus, on today only, everything with
        // no date and everything overdue. Undated work has to surface somewhere
        // or it is invisible, and today is the only day it is actionable; late
        // work belongs on today because today is when it still has to happen.
        // Planned items are left out here: they already have a time above.
        const plannedIds = new Set(blocks.map((b) => b.todoId))
        const due = todos.filter((t) => t.due === d.iso && !plannedIds.has(t.id) && t.kind !== 'response')
        const late = d.isToday ? todos.filter((t) => t.due && t.due < d.iso && !t.done) : []
        const loose = d.isToday ? todos.filter((t) => !t.due && !t.done) : []
        const items = [...late, ...due, ...loose]
        const date = parseIso(d.iso)
        const set = setOn(date)
        const mine = blocks.filter((b) => b.day === d.iso)
        const expanded = open.has(d.iso)

        // A block sitting in a free makes the free redundant on screen; lab
        // time keeps its row because it is a named thing, not just a gap.
        const periods = periodsFor(date).filter(
          (p) =>
            p.kind !== 'free' ||
            !mine.some((b) => toMin(b.start) < toMin(p.end) && toMin(b.end) > toMin(p.start)),
        )
        type Row = { at: number; key: string; node: React.ReactNode }
        const rows: Row[] = []
        if (expanded) {
          periods.forEach((p) => {
            const live = d.isToday && nowMin >= toMin(p.start) && nowMin < toMin(p.end)
            rows.push({
              at: toMin(p.start),
              key: `p${p.start}`,
              node: (
                <div className={`tt-row tt-${p.kind}${live ? ' tt-now' : ''}`}>
                  <span className="tt-time">
                    {p.start}–{p.end}
                  </span>
                  <span className="tt-what">{periodLabel(p)}</span>
                </div>
              ),
            })
          })
        }
        mine.forEach((b) => {
          const live = d.isToday && nowMin >= toMin(b.start) && nowMin < toMin(b.end)
          rows.push({
            // Just after a period starting at the same minute, so lab time
            // reads before the hour spent in it.
            at: toMin(b.start) + 0.5,
            key: `b${b.todoId || b.title}`,
            node: (
              <div className={`tt-row tt-plan tt-plan-${b.kind}${live ? ' tt-now' : ''}`}>
                <span className="tt-time">
                  {b.start}–{b.end}
                </span>
                <span className="tt-what">
                  {b.title} <span className="tt-len">· {blockLength(b)}</span>
                </span>
                {b.todoId && (
                  <button className="tt-tick" onClick={() => toggle(b.todoId)} aria-label={`Done: ${b.title}`}>
                    ✓
                  </button>
                )}
              </div>
            ),
          })
        })
        rows.sort((a, b) => a.at - b.at)

        return (
          <div className={d.isToday ? 'tt-day tt-today' : 'tt-day'} key={d.iso}>
            <button className="tt-when" onClick={() => flip(d.iso)} aria-expanded={expanded}>
              <span className="tt-label">{d.label}</span>
              <span className="tt-school">
                {d.school ? `school ${d.school.start} – ${d.school.end}` : 'no school'}
                {set.length > 0 && ` · ${set.map((w) => w.subject).join(', ')} set`}
              </span>
              <span className="tt-fold">{expanded ? '−' : '+'}</span>
            </button>

            {rows.map((r) => (
              <div key={r.key}>{r.node}</div>
            ))}

            {items.length > 0 && (
              <div className="tt-list">
                {items.map((t) => (
                  <div className={t.done ? 'tt-slot tt-done' : 'tt-slot'} key={t.id}>
                    {t.text}
                    {t.due && t.due < d.iso && <span className="tt-late"> · overdue</span>}
                    {t.assumed && <span className="todo-assumed">assumed</span>}
                  </div>
                ))}
              </div>
            )}

            {!expanded && rows.length === 0 && items.length === 0 && (
              <div className="tt-slot tt-empty">nothing planned</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------------------- todo */

/** Open work by due day, soonest first and undated last; ties in the order added. */
function byDue(a: Todo, b: Todo) {
  const x = a.due ?? '9999-99-99'
  const y = b.due ?? '9999-99-99'
  return x < y ? -1 : x > y ? 1 : a.at - b.at
}

/** A day `n` after today, as the list stores it. */
function fromToday(n: number) {
  const now = new Date()
  return isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n))
}

function TodoList() {
  const todos = useStore((s) => s.todos)
  const add = useStore((s) => s.addTodo)
  const update = useStore((s) => s.updateTodo)
  const toggle = useStore((s) => s.toggleTodo)
  const remove = useStore((s) => s.removeTodo)
  const [draft, draft_] = useState('')
  const [draftDue, draftDue_] = useState('')
  /** The row whose words or day are open for editing, if any. One at a time. */
  const [editing, editing_] = useState<{ id: string; what: 'text' | 'due' } | null>(null)
  const [words, words_] = useState('')

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    // "econ essay due fri" files the essay under Friday; the date box, if
    // set, wins over anything typed.
    const { text, due } = parseDue(draft)
    if (!text) return
    add(text, draftDue || due)
    draft_('')
    draftDue_('')
  }

  const startText = (t: Todo) => {
    words_(t.text)
    editing_({ id: t.id, what: 'text' })
  }
  const saveText = (t: Todo) => {
    const next = words.trim()
    if (next && next !== t.text) update(t.id, { text: next })
    editing_(null)
  }
  const setDue = (t: Todo, due: string | null) => {
    update(t.id, { due })
    editing_(null)
  }

  const open = todos.filter((t) => !t.done).sort(byDue)
  const done = todos.filter((t) => t.done)
  // Where the planner has put each item, so the list says when, not just by when.
  const when = new Map(plan(todos).map((b) => [b.todoId, b]))
  const today = isoDay(new Date())

  return (
    <div className="tabpanel-body" data-hit-rescue>
      <form className="todo-add" onSubmit={submit}>
        {/* Enter is handled explicitly rather than left to the form's implicit
            submission. Implicit submit is conditional on things that are not
            obvious from here and it was observed not firing, which loses the
            line he just typed. An explicit key handler always fires. */}
        <input
          className="todo-field"
          value={draft}
          onChange={(e) => draft_(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(e)
          }}
          placeholder="ADD SOMETHING · “DUE FRI” SETS A DAY"
          aria-label="Add a task"
          autoComplete="off"
        />
        <input
          className="todo-date"
          type="date"
          value={draftDue}
          onChange={(e) => draftDue_(e.target.value)}
          aria-label="Due date"
        />
        <button className="todo-plus" type="submit" disabled={!draft.trim()} aria-label="Add">
          +
        </button>
      </form>

      {todos.length === 0 && <p className="tt-empty">Nothing on the list yet.</p>}

      {/* Open first by due day, done underneath. A list that keeps completed
          work inline makes him re-read the same finished line every time. */}
      {[...open, ...done].map((t) => {
        const due = t.due ? dueLabel(t.due) : null
        const editingText = editing?.id === t.id && editing.what === 'text'
        const editingDue = editing?.id === t.id && editing.what === 'due'
        return (
          <div className={t.done ? 'todo-row todo-is-done' : 'todo-row'} key={t.id}>
            <button
              className="todo-tick"
              onClick={() => toggle(t.id)}
              aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
            >
              {t.done ? '✓' : ''}
            </button>

            {editingText ? (
              <input
                className="todo-field todo-edit"
                value={words}
                autoFocus
                // Selected, so typing replaces a placeholder rather than adding to it.
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => words_(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveText(t)
                  if (e.key === 'Escape') editing_(null)
                }}
                onBlur={() => saveText(t)}
                aria-label="Edit task"
              />
            ) : (
              // A button, so a pinch can open it for editing like anything else.
              <button className="todo-text" onClick={() => startText(t)} title="Edit">
                {t.text}
                {t.assumed && <span className="todo-assumed">assumed</span>}
                {when.has(t.id) && (
                  <span className="todo-planned">
                    {when.get(t.id)!.day === today
                      ? `today ${when.get(t.id)!.start}`
                      : `${parseIso(when.get(t.id)!.day).toLocaleDateString('en-GB', { weekday: 'short' })} ${when.get(t.id)!.start}`}
                  </span>
                )}
              </button>
            )}

            <button
              className={due ? `todo-due todo-due-${due.state}` : 'todo-due todo-due-none'}
              onClick={() => editing_(editingDue ? null : { id: t.id, what: 'due' })}
              aria-label={due ? `Due ${due.text}, change` : 'Set a due date'}
            >
              {due ? due.text : '+ date'}
            </button>

            <button className="todo-x" onClick={() => remove(t.id)} aria-label="Remove">
              ✕
            </button>

            {editingDue && (
              // Whole buttons for the common answers, because a native date
              // picker is a small target for a hand; the picker is still
              // there for anything further out.
              <div className="todo-when">
                <button className="todo-chip" onClick={() => setDue(t, fromToday(0))}>today</button>
                <button className="todo-chip" onClick={() => setDue(t, fromToday(1))}>tomorrow</button>
                <button className="todo-chip" onClick={() => setDue(t, fromToday(7))}>in a week</button>
                <input
                  className="todo-date"
                  type="date"
                  value={t.due ?? ''}
                  onChange={(e) => e.target.value && setDue(t, e.target.value)}
                  aria-label="Pick a due date"
                />
                {t.due && (
                  <button className="todo-chip todo-chip-dim" onClick={() => setDue(t, null)}>
                    no date
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- briefing */

/**
 * The briefing tab reopens rather than regenerates.
 *
 * Asking for it again costs a model turn and, more to the point, produces a
 * different briefing — so "show me that again" would silently become "do it
 * once more", and the thing he glanced at would be gone. Only when there is
 * nothing to reopen does it ask for a new one.
 */
function Briefing({ onAsk }: { onAsk: (prompt: string) => void }) {
  const archive = useStore((s) => s.archive)
  const restore = useStore((s) => s.restoreBlade)

  const last = [...archive]
    .reverse()
    .find((a) => /brief|morning|inbox|mail|day/i.test(a.title))

  return (
    <div className="tabpanel-body" data-hit-rescue>
      {last ? (
        <>
          <p className="tt-empty">
            Last briefing: {last.title.toLowerCase()},{' '}
            {new Date(last.at).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
            .
          </p>
          <button className="tab-action" onClick={() => restore(last.id)}>
            REOPEN IT
          </button>
          <button className="tab-action tab-action-dim" onClick={() => onAsk(OPENING_BRIEFING)}>
            RUN A NEW ONE
          </button>
        </>
      ) : (
        <>
          <p className="tt-empty">No briefing yet this session.</p>
          <button className="tab-action" onClick={() => onAsk(OPENING_BRIEFING)}>
            RUN THE BRIEFING
          </button>
        </>
      )}
    </div>
  )
}


/* ----------------------------------------------------------------------- news */

/**
 * The Economist and Bloomberg, read properly.
 *
 * Same shape as the briefing tab: reopen what is already there rather than
 * spending a model turn regenerating it, because "show me that again" and "do
 * it again" are different requests and only one of them is what a tab means.
 */
function News({ onAsk }: { onAsk: (prompt: string) => void }) {
  const archive = useStore((s) => s.archive)
  const restore = useStore((s) => s.restoreBlade)

  const last = [...archive]
    .reverse()
    .find((a) => /news|economist|bloomberg|markets/i.test(a.title))

  return (
    <div className="tabpanel-body" data-hit-rescue>
      <p className="tt-empty">
        {last
          ? `Last read ${new Date(last.at).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}.`
          : 'The Economist and Bloomberg, from your inbox.'}
      </p>
      <button className="tab-action" onClick={() => onAsk(NEWS_BRIEFING)}>
        READ THE NEWS
      </button>
      {last && (
        <button className="tab-action tab-action-dim" onClick={() => restore(last.id)}>
          REOPEN THE LAST ONE
        </button>
      )}
      <p className="tt-empty">Right hand, four fingers, held still does the same.</p>
    </div>
  )
}

/* ----------------------------------------------------------------------- tabs */

export function Tabs({ onAsk }: { onAsk: (prompt: string) => void }) {
  const phase = useStore((s) => s.phase)
  const tab = useStore((s) => s.tab)
  const openTab = useStore((s) => s.openTab)

  if (phase === 'offline' || phase === 'boot') return null

  return (
    <div className="tabs">
      <div className="tabstrip" data-hit-rescue>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab tab-on' : 'tab'}
            onClick={() => openTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {tab && (
          <motion.section
            className="tabpanel"
            initial={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          >
            <span className="pk pk-tl" />
            <span className="pk pk-tr" />
            <span className="pk pk-bl" />
            <span className="pk pk-br" />

            {tab === 'timetable' && <Timetable />}
            {tab === 'todo' && <TodoList />}
            {tab === 'briefing' && <Briefing onAsk={onAsk} />}
            {tab === 'news' && <News onAsk={onAsk} />}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
