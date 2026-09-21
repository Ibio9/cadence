import { useEffect, useState } from 'react'
import { useStore, type Todo } from '../store'
import { fromMin, isoDay, parseIso, periodsFor, plan, toMin, type Period } from '../lib/schedule'

/**
 * What he should be doing right now, under the orb.
 *
 * Worked out from the same two things the timetable tab shows: the school day
 * (shared/week.json) and the time the planner has set aside (homework,
 * Response hours). A planned block beats the free or lab time it sits in,
 * because that is the point of planning it. One line for now, one for next,
 * small and quiet: something to glance at, not to read.
 */

type Item = { start: number; end: number; label: string; kind: string }

function nameOf(p: Period): string {
  switch (p.kind) {
    case 'lesson':
    case 'society':
    case 'sport':
      return p.subject ?? p.kind
    case 'lab':
      return 'Lab time'
    case 'lunch':
      return 'Lunch'
    case 'free':
      return 'Free'
    case 'tutor':
      return 'Tutor time'
    default:
      return p.subject ?? p.kind
  }
}

function read(now: Date, todos: Todo[]): { now: string; next: string | null } {
  const today = isoDay(now)
  const m = now.getHours() * 60 + now.getMinutes()
  const blocks = plan(todos, now)
  const items: Item[] = [
    ...periodsFor(now)
      .filter((p) => p.kind !== 'break')
      .map((p) => ({ start: toMin(p.start), end: toMin(p.end), label: nameOf(p), kind: p.kind })),
    ...blocks
      .filter((b) => b.day === today)
      .map((b) => ({ start: toMin(b.start), end: toMin(b.end), label: b.title, kind: 'plan' })),
  ]

  const current = items
    .filter((i) => i.start <= m && m < i.end)
    .sort((a, b) => (a.kind === 'plan' ? -1 : b.kind === 'plan' ? 1 : 0))[0]
  const school = periodsFor(now)
  const beforeSchool = school.length > 0 && m < toMin(school[0].start)
  const nowText = current
    ? `${current.label} · until ${fromMin(current.end)}`
    : beforeSchool
      ? `Before school · starts ${school[0].start}`
      : 'Your time'

  // Next: the next real thing today (not a free or lunch), else the next
  // planned block on a later day, else nothing worth saying.
  const later = items
    .filter((i) => i.start > m && i.kind !== 'free' && i.kind !== 'lunch')
    .sort((a, b) => a.start - b.start)[0]
  let next: string | null = later ? `${later.label} · ${fromMin(later.start)}` : null
  if (!next) {
    const ahead = blocks.find((b) => b.day > today)
    if (ahead) {
      const day = parseIso(ahead.day).toLocaleDateString('en-GB', { weekday: 'short' })
      next = `${ahead.title} · ${day} ${ahead.start}`
    }
  }
  return { now: nowText, next }
}

export function NowLine() {
  const phase = useStore((s) => s.phase)
  const todos = useStore((s) => s.todos)
  const [clock, clock_] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => clock_(new Date()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  if (phase === 'offline' || phase === 'boot') return null
  const { now, next } = read(clock, todos)
  return (
    <div className="now-line" aria-live="polite">
      <div className="now-row">
        <span className="now-k">NOW</span>
        <span className="now-v">{now}</span>
      </div>
      {next && (
        <div className="now-row now-next">
          <span className="now-k">NEXT</span>
          <span className="now-v">{next}</span>
        </div>
      )}
    </div>
  )
}
