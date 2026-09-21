import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'

/**
 * What your hands can do.
 *
 * A touchless interface has the same problem a voice interface has: no menus,
 * no buttons, nothing on screen that tells you what is possible. The
 * suggestions strip solves that for speech, and this is its equivalent for
 * hands — shown when the camera comes on, when you would actually be wondering.
 *
 * It used to appear whenever the camera came on and fade after the first
 * pinch. Now it is his to call up: I opens it and closes it (Escape or the
 * button closes it too), and G only turns the camera on. A legend that
 * arrives uninvited sits on top of whatever he was about to look at.
 */

const MOVES: { gesture: string; hand: string; does: string }[] = [
  { gesture: 'point', hand: '☝', does: 'move the cursor' },
  { gesture: 'pinch', hand: '🤏', does: 'click · or hold on a blade to move it' },
  { gesture: 'throw', hand: '🎯', does: 'pinch a blade, carry it towards a device, push and let go' },
  { gesture: 'open', hand: '🖐', does: 'let go' },
  { gesture: 'peace', hand: '✌', does: 'two fingers up-down to scroll' },
  { gesture: 'frame', hand: '📐', does: 'two L-corners to resize' },
  { gesture: 'M', hand: '🤟', does: 'right · three fingers · re-read the mail' },
  { gesture: '4', hand: '🖖', does: 'right · four fingers · Economist + Bloomberg' },
  { gesture: '1', hand: '☝', does: 'left · hold still · the morning briefing' },
  { gesture: '4', hand: '✋', does: 'left · four fingers · history' },
]

export function GestureGuide() {
  const show = useStore((s) => s.guideOpen)
  const close = useStore((s) => s.toggleGuide)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="gguide"
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 8, filter: 'blur(6px)', transition: { duration: 0.5 } }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        >
          <div className="gguide-head">HAND CONTROL</div>
          {MOVES.map((m) => (
            <div key={`${m.gesture}${m.does}`} className="gguide-row">
              <span className="gguide-icon">{m.hand}</span>
              <span className="gguide-name">{m.gesture}</span>
              <span className="gguide-does">{m.does}</span>
            </div>
          ))}
          <div className="gguide-foot">
            <kbd>I</kbd> closes this · <kbd>G</kbd> turns the camera on or off
            <button className="gguide-close" onClick={() => close(false)} aria-label="Close">
              ✕
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
