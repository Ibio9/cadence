import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, type Tab } from '../store'
import { upcoming } from '../lib/schedule'
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

function Timetable() {
  const todos = useStore((s) => s.todos)
  const days = upcoming(7)

  return (
    <div className="tabpanel-body" data-hit-rescue>
      {days.map((d) => {
        // Anything promised to this day, plus — on today only — everything with
        // no date at all. Undated work has to surface somewhere or it is
        // invisible, and today is the only day it is actually actionable.
        const due = todos.filter((t) => t.due === d.iso)
        const loose = d.isToday ? todos.filter((t) => !t.due && !t.done) : []
        const items = [...due, ...loose]

        return (
          <div className={d.isToday ? 'tt-day tt-today' : 'tt-day'} key={d.iso}>
            <div className="tt-when">
              <span className="tt-label">{d.label}</span>
              <span className="tt-school">
                {d.school ? `school ${d.school.start} – ${d.school.end}` : 'no school'}
              </span>
            </div>

            {d.school && (
              <div className="tt-slot tt-fixed">
                {d.school.start} – {d.school.end} · school
              </div>
            )}

            {items.length === 0 ? (
              <div className="tt-slot tt-empty">nothing on the list</div>
            ) : (
              items.map((t) => (
                <div className={t.done ? 'tt-slot tt-done' : 'tt-slot'} key={t.id}>
                  {t.text}
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ----------------------------------------------------------------------- todo */

function TodoList() {
  const todos = useStore((s) => s.todos)
  const add = useStore((s) => s.addTodo)
  const toggle = useStore((s) => s.toggleTodo)
  const remove = useStore((s) => s.removeTodo)
  const [draft, draft_] = useState('')

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    add(text)
    draft_('')
  }

  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

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
          placeholder="ADD SOMETHING"
          aria-label="Add a task"
          autoComplete="off"
        />
        <button className="todo-plus" type="submit" disabled={!draft.trim()} aria-label="Add">
          +
        </button>
      </form>

      {todos.length === 0 && <p className="tt-empty">Nothing on the list yet.</p>}

      {/* Open first, done underneath. A list that keeps completed work inline
          makes him re-read the same finished line every time he looks. */}
      {[...open, ...done].map((t) => (
        <div className={t.done ? 'todo-row todo-is-done' : 'todo-row'} key={t.id}>
          <button
            className="todo-tick"
            onClick={() => toggle(t.id)}
            aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
          >
            {t.done ? '✓' : ''}
          </button>
          <span className="todo-text">{t.text}</span>
          {t.due && <span className="todo-due">{t.due.slice(5)}</span>}
          <button className="todo-x" onClick={() => remove(t.id)} aria-label="Remove">
            ✕
          </button>
        </div>
      ))}
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
