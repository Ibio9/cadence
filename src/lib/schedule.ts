/**
 * The shape of Ibrahim's week.
 *
 * The timetable itself lives in shared/week.json, read here by Vite and by
 * bridge/personal.mjs through the file system. It used to be copied into both
 * places by hand, which was tolerable for five finish times and is not for a
 * full timetable: two copies of forty periods drift, and the symptom is JARVIS
 * planning around a lesson the screen says is a free.
 */
import WEEK from '../../shared/week.json'

export type PeriodKind = 'tutor' | 'lesson' | 'free' | 'lunch' | 'break' | 'lab' | 'sport' | 'society'
export type Period = { start: string; end: string; kind: PeriodKind; subject?: string }

/** Keyed by weekday, 1 is Monday; weekends are absent. */
const DAYS = WEEK.days as Record<string, Period[]>

/** The school day, tutor time first, or nothing on a weekend. */
export function periodsFor(d: Date): Period[] {
  const list = DAYS[String(d.getDay())]
  if (!list) return []
  return [{ ...WEEK.tutor, kind: 'tutor', subject: 'Tutor time' }, ...list]
}

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
  const list = DAYS[String(d.getDay())]
  return list?.length ? { start: WEEK.tutor.start, end: list[list.length - 1].end } : null
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
 * marked as assumed until he says what the work actually is. From
 * shared/week.json, which the bridge reads too.
 */
export const SET_WORK: { subject: string; weekday: number }[] = WEEK.setWork

/** Assumed due the same weekday a week later, until he says otherwise. */
export const SET_WORK_DUE_DAYS: number = WEEK.setWorkDueDays

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

/* ------------------------------------------------------------------ the plan */

/** 'HH:MM' to minutes after midnight, and back. */
export const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

/** The Monday that starts this week, and the Sunday that ends it. */
export function weekOf(now = new Date()): { monday: string; sunday: string } {
  const monday = addDays(now, -((now.getDay() + 6) % 7))
  return { monday: isoDay(monday), sunday: isoDay(addDays(monday, 6)) }
}

/** The weekly Response hours, from shared/week.json. */
export const RESPONSE: { subjects: string[]; minutes: number } = WEEK.response

/** What the planner needs to know about a to-do item. */
export type Plannable = {
  id: string
  text: string
  done: boolean
  due: string | null
  kind?: 'setwork' | 'response'
  subject?: string
  /** For set work: the day it was set, whose evening the two hours belong to. */
  setOn?: string
}

/** Time set aside for something on the list. */
export type Block = {
  day: string
  start: string
  end: string
  kind: 'homework' | 'response'
  title: string
  /** Empty for an evening held for set work that has not been set yet. */
  todoId: string
}

const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Stretches of a school day with nothing timetabled: frees and lab time,
 * joined across the five-minute changeovers. Only these and the evening are
 * offered to the planner; lunch and break are his.
 */
function studyWindows(d: Date): [number, number][] {
  const out: [number, number][] = []
  for (const p of periodsFor(d)) {
    if (p.kind !== 'free' && p.kind !== 'lab') continue
    const a = toMin(p.start)
    const b = toMin(p.end)
    const last = out[out.length - 1]
    if (last && a - last[1] <= 5) last[1] = b
    else out.push([a, b])
  }
  return out
}

/** The evening, or on a weekend the day. */
function homeWindow(d: Date): [number, number] {
  const w = d.getDay() === 0 || d.getDay() === 6 ? WEEK.weekend : WEEK.evening
  return [toMin(w.start), toMin(w.end)]
}

/**
 * Where the work goes, worked out afresh every time from the list and the
 * clock. That is what makes it adaptive without any bookkeeping: a block whose
 * time runs out before it is ticked is simply placed again, in the next space
 * that fits, and a ticked item stops being placed at all.
 *
 * Set work gets two hours on the evening it is set. Work whose evening has
 * gone takes the next evening before it is due, but never one that belongs
 * to work set that day.
 *
 * Response hours go into school frees and lab time first, one a day, so they
 * cost him no evenings at all where the week allows; then into evenings with
 * nothing else in them; and only when the week has run short do they double
 * up on an evening that already has something.
 */
export function plan(todos: Plannable[], now = new Date(), days = 7): Block[] {
  const today = isoDay(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const horizon: Date[] = Array.from({ length: days }, (_, i) => addDays(now, i))
  const taken = new Map<string, [number, number][]>()
  const blocks: Block[] = []
  const evening = new Map<string, number>()
  const school = new Map<string, number>()

  const clashes = (day: string, a: number, b: number) =>
    (taken.get(day) ?? []).some(([x, y]) => a < y && b > x)
  const take = (block: Block) => {
    blocks.push(block)
    const list = taken.get(block.day) ?? []
    list.push([toMin(block.start), toMin(block.end)])
    taken.set(block.day, list)
  }
  /** Past anything already in the way, with a quarter of an hour between. */
  const clear = (day: string, a: number, len: number) => {
    for (const [x, y] of [...(taken.get(day) ?? [])].sort((p, q) => p[0] - q[0])) {
      if (a < y && a + len > x) a = y + 15
    }
    return a
  }

  // -- set work ------------------------------------------------------------
  const hwStart = toMin(WEEK.homework.start)
  const hwLen = WEEK.homework.minutes
  const setWork = todos.filter((t) => !t.done && t.kind === 'setwork')
  const eveningFor = (t: Plannable, day: string) => {
    const [a, b] = [hwStart, hwStart + hwLen]
    // Kept until it ends, so the evening he is in the middle of stays put.
    if ((day === today && b <= nowMin) || clashes(day, a, b)) return false
    take({ day, start: fromMin(a), end: fromMin(b), kind: 'homework', title: t.text, todoId: t.id })
    evening.set(day, (evening.get(day) ?? 0) + 1)
    return true
  }
  const inHorizon = (day: string) => day >= today && day <= isoDay(horizon[horizon.length - 1])
  // Each piece on its own evening first, so a new set of work always gets the
  // evening it was set, whatever is running late.
  const late = setWork.filter((t) => !(t.setOn && inHorizon(t.setOn) && eveningFor(t, t.setOn)))
  late
    .sort((a, b) => ((a.due ?? '9999') < (b.due ?? '9999') ? -1 : 1))
    .forEach((t) => {
      for (const d of horizon) {
        const day = isoDay(d)
        if (t.due && day >= t.due) break
        if (t.setOn && day < t.setOn) continue
        if (eveningFor(t, day)) break
      }
    })

  // Evenings that will get set work later this week, shown before the work
  // exists so the week reads true and nothing else is booked into them.
  for (const d of horizon) {
    const day = isoDay(d)
    if (day <= today) continue
    for (const w of setOn(d)) {
      if (todos.some((t) => t.kind === 'setwork' && t.subject === w.subject && t.setOn === day)) continue
      eveningFor({ id: '', text: `${w.subject} homework (expected)`, done: false, due: null }, day)
    }
  }

  // -- response ------------------------------------------------------------
  const len = RESPONSE.minutes
  const pending = todos
    .filter((t) => !t.done && t.kind === 'response')
    .sort((a, b) => RESPONSE.subjects.indexOf(a.subject ?? '') - RESPONSE.subjects.indexOf(b.subject ?? ''))

  /** Try one space; true if the hour went in. */
  const tryWindow = (t: Plannable, day: string, wa: number, wb: number) => {
    let a = clear(day, wa, len)
    // A space whose start has gone by today is still usable from now on, from
    // the quarter hour now falls in: anchored there, not to the minute, so the
    // hour stays put for the quarter he spends deciding to start it.
    if (day === today && a + len <= nowMin) a = clear(day, Math.max(a, Math.floor(nowMin / 15) * 15), len)
    const b = a + len
    if (b > wb || clashes(day, a, b)) return false
    take({ day, start: fromMin(a), end: fromMin(b), kind: 'response', title: t.text, todoId: t.id })
    return true
  }

  type Stage = 'school' | 'quiet evening' | 'any'
  const place = (t: Plannable, stage: Stage) => {
    for (const d of horizon) {
      const day = isoDay(d)
      if (t.due && day > t.due) break
      if (stage === 'school') {
        if (school.get(day)) continue
        for (const [wa, wb] of studyWindows(d)) {
          if (tryWindow(t, day, wa, wb)) {
            school.set(day, 1)
            return true
          }
        }
        continue
      }
      if (stage === 'quiet evening' && evening.get(day)) continue
      const windows = stage === 'any' ? [...studyWindows(d), homeWindow(d)] : [homeWindow(d)]
      for (const [wa, wb] of windows) {
        if (tryWindow(t, day, wa, wb)) {
          evening.set(day, (evening.get(day) ?? 0) + 1)
          return true
        }
      }
    }
    return false
  }
  pending
    .filter((t) => !place(t, 'school'))
    .filter((t) => !place(t, 'quiet evening'))
    .forEach((t) => place(t, 'any'))

  return blocks.sort((x, y) => (x.day + x.start < y.day + y.start ? -1 : 1))
}

export { parseIso }
