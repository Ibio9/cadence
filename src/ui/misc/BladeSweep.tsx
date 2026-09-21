import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../../store'

/**
 * MISC — the tool-call sweep, kept rather than deleted.
 *
 * Taken off screen on Ibrahim's instruction (21 September 2026): the diagonal
 * lines of light that raked across the whole frame while a tool ran. The
 * "ACCESSING ..." badge at the top already says a tool is running, so nothing
 * is lost by it going. Nothing here is imported by the running interface.
 *
 * To put it back: import BladeSweep in Hud.tsx and render <BladeSweep /> where
 * it was, just after <Blades />. Its styles (.blades, .blade-field, .blade-1
 * to .blade-6, .blade-carrier, .blade-tool) are still in index.css.
 */

/* --------------------------------------------------------------- the sweep */

/**
 * The original blades: slivers of light raking across the frame while a tool
 * runs. Unchanged, because it is still the right answer to "something is
 * happening" — a tool call is the one moment the interface stops being a face
 * and becomes machinery, and the reactor cannot carry that on its own.
 *
 * Deliberately CSS rather than three.js: the scene is bloomed and tone-mapped,
 * which is exactly wrong for a 1px edge. Kept in the DOM it stays a blade.
 */
const SWEEP = [1, 2, 3, 4, 5, 6]

export function BladeSweep() {
  const phase = useStore((s) => s.phase)
  const activeTool = useStore((s) => s.activeTool)

  return (
    <AnimatePresence>
      {phase === 'tooling' && (
        <motion.div
          className="blades"
          // Only opacity is animated here. The sweeps are CSS keyframes on the
          // children, and framer writes `transform` inline on anything it
          // animates — one transform prop in this list and every blade would be
          // sliding inside an element that is itself sliding.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <div className="blade-field">
            {SWEEP.map((n) => (
              <span key={n} className={`blade blade-${n}`} />
            ))}
          </div>

          {activeTool && (
            // Keyed on the name so a chain of tools re-runs the ride-in for
            // each one rather than silently swapping the text mid-sweep.
            <div className="blade-carrier">
              <span key={activeTool} className="blade-tool">
                {activeTool}
              </span>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
