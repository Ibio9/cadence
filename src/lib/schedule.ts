/**
 * The shape of Ibrahim's week.
 *
 * Deliberately duplicated from bridge/personal.mjs rather than shared. The two
 * live on opposite sides of a socket and in different build systems, and the
 * alternative — a JSON file loaded by a Node bridge and imported by Vite — buys
 * one constant at the cost of a build step and a runtime fetch.
 *
 * The rule if it ever changes: edit both. There are exactly two places and
 * this comment is in one of them.
 */

/** 0 is Sunday. School always starts at 09:00; only the finish moves. */
const SCHOOL_END: Record<number, string> = {
  1: '14:00', // Monday
  2: '16:10',
  3: '16:10',
  4: '14:00', // Thursday
  5: '16:10',
}

export const SCHOOL_START = '09:00'

export type Day = {
  /** 'YYYY-MM-DD', built from local parts so it names the day he is living in. */
  iso: string
  /** 'Today', 'Tomorrow', then 'Thu 24 Sep'. */
  label: string
  /** null on a weekend. */
  school: { start: string; end: string } | null
  isToday: boolean
}

/**
 * Local, not ISO.
 *
 * `toISOString()` converts to UTC first, so any evening in British Summer Time
 * lands on the previous day. That is the bug that makes a to-do quietly vanish
 * from the timetable it was due on.
 */
export function isoDay(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function schoolFor(d: Date): Day['school'] {
  const end = SCHOOL_END[d.getDay()]
  return end ? { start: SCHOOL_START, end } : null
}

/** Today and the next `count - 1` days. */
export function upcoming(count = 7, from = new Date()): Day[] {
  const out: Day[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)
    out.push({
      iso: isoDay(d),
      label:
        i === 0
          ? 'Today'
          : i === 1
            ? 'Tomorrow'
            : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      school: schoolFor(d),
      isToday: i === 0,
    })
  }
  return out
}
