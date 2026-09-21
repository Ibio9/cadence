import { useEffect, useState } from 'react'
import { useStore } from '../store'

/**
 * The start-up sequence: a line of text saying what is actually happening.
 *
 * It began as four beats of Iron Man pastiche — a segmented loading bar over a
 * scrolling log, reticle rings resolving the name, a wireframe suit schematic,
 * then the arc reactor lighting — paced by a hardcoded 9.2 second wait. All of
 * it is gone at Ibrahim's request and none of it is deleted: see
 * src/ui/misc/BootExtras.tsx.
 *
 * What replaced it is honest about the wait. Each line names a real stage of
 * the power-up, and because the opening briefing is now fetched *during* the
 * boot rather than after it, "reading your mail" describes what the machine is
 * doing at that moment rather than decorating a pause.
 *
 * ---------------------------------------------------------------------------
 * NO AnimatePresence IN THIS FILE, AND NO POINTER EVENTS. Both are deliberate
 * and both were learned the hard way, twice.
 *
 * Ignition.tsx already carries the first lesson: a `position: fixed; inset: 0`
 * overlay that fails to unmount is invisible, unremovable, and the topmost
 * hit-testable thing under every point on the screen. Hand control resolves
 * its target with elementFromPoint, so every pinch lands on it silently.
 *
 * This file reproduced that exactly. The aura had a framer-motion animation
 * with `repeat: Infinity`, and AnimatePresence waits for a leaving subtree's
 * animations to finish before it removes the node — an infinite one never
 * does. The overlay stayed at full opacity and z-index 120 over the whole
 * interface, and the visible symptom was that pressing the tabs did nothing.
 *
 * So: a plain conditional, which cannot strand anything, and the fade is a CSS
 * class rather than an exit animation. On top of that the overlay is
 * `pointer-events: none` in CSS. Nothing in here is clickable, so it has no
 * business intercepting input, and that single line means even a future bug
 * that strands it cannot break the interface again.
 * ---------------------------------------------------------------------------
 */

/** How long the overlay stays, from the moment the boot phase begins. */
const HOLD_MS = 3600
/** How long it spends fading at the end of that. */
const FADE_MS = 650

/**
 * What it says, and when.
 *
 * Deliberately in the order the machine really does them. The last line has no
 * ellipsis because it is not a process, it is the hand-off.
 */
const STAGES: { at: number; text: string; hue: string }[] = [
  { at: 0, text: 'initialising', hue: '#4fd6ff' },
  { at: 700, text: 'linking the bridge', hue: '#7b5cff' },
  { at: 1500, text: 'reading your mail', hue: '#25e0a6' },
  { at: 2400, text: 'building your day', hue: '#ffc46b' },
  { at: 3150, text: 'good morning', hue: '#ffffff' },
]

export function Boot() {
  const phase = useStore((s) => s.phase)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [t, setT] = useState(0)

  // Arming is the only thing the phase decides. Entering 'boot' starts the
  // clock; returning to 'offline' disarms, so a second power-on plays again.
  useEffect(() => {
    if (phase === 'boot' && startedAt === null) {
      setStartedAt(Date.now())
      setT(0)
    } else if (phase === 'offline' && startedAt !== null) {
      setStartedAt(null)
      setT(0)
    }
  }, [phase, startedAt])

  /*
   * The clock, keyed on `startedAt` and NOT on the phase.
   *
   * That distinction is load-bearing. When this was keyed on the phase, the
   * briefing moving the phase mid-boot made React run the cleanup, clear the
   * interval, then re-enter and bail at the guard because the clock was
   * already armed — leaving the overlay frozen wherever the change landed.
   * `startedAt` does not change when the phase does.
   *
   * The trailing setTimeout is a watchdog, not decoration. setInterval is
   * throttled hard in a background tab and can miss the tick that would have
   * ended the sequence; the timeout guarantees the overlay comes down even if
   * the interval never delivers another callback.
   */
  useEffect(() => {
    if (startedAt === null) return
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setT(elapsed)
      if (elapsed >= HOLD_MS) clearInterval(id)
    }, 40)
    const done = setTimeout(() => setT(HOLD_MS), HOLD_MS + 250)
    return () => {
      clearInterval(id)
      clearTimeout(done)
    }
  }, [startedAt])

  // A plain conditional. Nothing to wait for, nothing that can be left behind.
  if (startedAt === null || t >= HOLD_MS) return null

  // The last stage whose time has come.
  let i = 0
  for (let k = 0; k < STAGES.length; k++) if (t >= STAGES[k].at) i = k
  const stage = STAGES[i]

  return (
    <div
      className={t >= HOLD_MS - FADE_MS ? 'boot boot-out' : 'boot'}
      style={{ ['--boot-hue' as string]: stage.hue }}
    >
      <div className="boot-stage">
        {/* Pulsed by CSS, not framer. See the note at the top of this file:
            an infinite framer animation in here is what stranded the overlay. */}
        <div className="boot-aura" />

        {/* One line at a time. `key` on the text remounts the span when the
            stage changes, which is what replays the CSS entrance — the same
            effect AnimatePresence was giving, without anything to wait on. */}
        <div className="boot-words">
          <span key={stage.text} className="boot-word">
            {stage.text}
            {i < STAGES.length - 1 && <span className="boot-ell">…</span>}
          </span>
        </div>

        {/* A hairline that fills across the sequence. Unlike the bar it
            replaced, this measures something real: the overlay's own fixed
            duration, which is what the person is actually waiting on. */}
        <div className="boot-track">
          <div
            className="boot-fill"
            style={{ transform: `scaleX(${Math.min(1, t / HOLD_MS)})` }}
          />
        </div>
      </div>
    </div>
  )
}
