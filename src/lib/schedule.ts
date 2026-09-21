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

/* ----------------------------------------------------------------- set work */

/**
 * Homework that is set on the same weekday every week.
 *
 * Teams does not email an assignment when it is set and the school will not
 * let anything outside read Teams, so this is the next best thing: a standing
 * assumption. On the day a subject is set, a placeholder goes on the list,
 * marked as assumed until he says what the work actually is. Mirrored in
 * bridge/personal.mjs, like SCHOOL_END; edit both.
 */
export const SET_WORK: { subject: string; weekday: number }[] = [
  { subject: 'Philosophy', weekday: 1 }, // Monday
  { subject: 'Maths', weekday: 3 }, // Wednesday
]

/** Assumed due the same weekday a week later, until he says otherwise. */
export const SET_WORK_DUE_DAYS = 7

/** What is set on this day, for the timetable. */
export const setOn = (d: Date) => SET_WORK.filter((w) => w.weekday === d.getDay())

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/**
 * Everything set so far this week, Monday to today.
 *
 * The whole week rather than only today, so a Monday he never opened the
 * interface still produces its Philosophy placeholder on Tuesday. Never
 * earlier weeks: work from a fortnight ago is either done or known about.
 */
export function setWorkSoFar(now = new Date()): { subject: string; set: string; due: string; key: string }[] {
  const sinceMonday = (now.getDay() + 6) % 7
  const monday = addDays(now, -sinceMonday)
  return SET_WORK.filter((w) => (w.weekday + 6) % 7 <= sinceMonday).map((w) => {
    const set = addDays(monday, (w.weekday + 6) % 7)
    return {
      subject: w.subject,
      set: isoDay(set),
      due: isoDay(addDays(set, SET_WORK_DUE_DAYS)),
      key: `${w.subject.toLowerCase()}:${isoDay(set)}`,
    }
  })
}

/**
 * A due date as he would say it: 'today', 'tomorrow', 'Mon 28 Sep', or
 * 'overdue · 18 Sep'. `soon` covers today and tomorrow, for highlighting.
 */
export function dueLabel(iso: string, now = new Date()): { text: string; state: 'late' | 'soon' | 'later' } {
  const [y, m, d] = iso.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.round((then.getTime() - today.getTime()) / 86400000)
  const short = then.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  if (days < 0) return { text: `overdue · ${short}`, state: 'late' }
  if (days === 0) return { text: 'today', state: 'soon' }
  if (days === 1) return { text: 'tomorrow', state: 'soon' }
  return { text: short, state: 'later' }
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Pull a due date off the end of a typed task: "econ essay due fri",
 * "read ch 4 by tomorrow", "maths sheet due 2/10". Returns the text without
 * the date phrase, and the date, or the text untouched and null.
 *
 * Deliberately narrow. It only looks at a trailing "due" or "by" phrase, so a
 * task that merely mentions a day ("prep for Friday's debate") is left alone.
 */
export function parseDue(raw: string, now = new Date()): { text: string; due: string | null } {
  const m = raw.match(/^(.*?)[\s,]+(?:due|by)\s+(.+?)\s*$/i)
  if (!m) return { text: raw.trim(), due: null }
  const [, rest, phrase] = m
  const p = phrase.toLowerCase().replace(/\.$/, '')
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let when: Date | null = null
  if (p === 'today') when = today
  else if (p === 'tomorrow' || p === 'tmrw' || p === 'tmr') when = addDays(today, 1)
  else if (p === 'next week') when = addDays(today, 7)
  else {
    const wd = p.replace(/^next\s+/, '')
    const i = WEEKDAYS.findIndex((w) => w.startsWith(wd) && wd.length >= 3)
    if (i !== -1) {
      // The coming one, never today: "due monday" said on a Monday means next.
      // "Next friday" is read the same way; which Friday it means is a coin
      // toss in British English, and the nearer one is the safer mistake.
      when = addDays(today, (i - today.getDay() + 7) % 7 || 7)
    } else {
      const dm = p.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/)
      if (dm) {
        const day = Number(dm[1])
        const month = Number(dm[2]) - 1
        let year = dm[3] ? Number(dm[3]) : today.getFullYear()
        if (year < 100) year += 2000
        let d = new Date(year, month, day)
        // A day-month with no year that has already passed means next year.
        if (!dm[3] && d < today) d = new Date(year + 1, month, day)
        if (d.getMonth() === month && d.getDate() === day) when = d
      }
    }
  }
  return when ? { text: rest.trim(), due: isoDay(when) } : { text: raw.trim(), due: null }
}
