import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'

/**
 * Everything that has been on screen, and a way back to it.
 *
 * The display is deliberately forgetful: six blades at a time, and the ones
 * marked 'turn' are swept the moment he speaks again. That is the right
 * behaviour for a heads-up display and the wrong one for a morning briefing he
 * glanced at, asked a follow-up about, and then wanted back. This is the
 * ledger underneath it.
 *
 * Reopening goes through `restoreBlade` rather than pushing a copy, so the
 * revived blade keeps its identity and the archive records that it was seen
 * again rather than growing a second entry for the same thing.
 *
 * Every row is a real <button>. The hand tracker presses whatever is under the
 * cursor by synthesising a click, so making these buttons is what makes them
 * pinchable, and it is also what makes them work with a keyboard and a mouse
 * without a second code path.
 */

const KINDS: Record<string, string> = {
  markup: 'CARD',
  article: 'ARTICLE',
  image: 'IMAGE',
  gallery: 'GALLERY',
  video: 'VIDEO',
  embed: 'EMBED',
  camera: 'CAMERA',
}

/** "just now" / "12 min ago" / "14:02". Relative while it is still relative. */
function ago(at: number, now: number): string {
  const secs = Math.round((now - at) / 1000)
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min ago`
  return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function History() {
  const open = useStore((s) => s.historyOpen)
  const archive = useStore((s) => s.archive)
  const restore = useStore((s) => s.restoreBlade)
  const toggle = useStore((s) => s.toggleHistory)

  // Read once per render rather than per row, so a list of twenty does not
  // disagree with itself about what "just now" means.
  const now = Date.now()

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className="history"
          initial={{ opacity: 0, x: -18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: -14, filter: 'blur(6px)' }}
          transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        >
          <span className="pk pk-tl" />
          <span className="pk pk-tr" />
          <span className="pk pk-bl" />
          <span className="pk pk-br" />

          <header className="history-head">
            <span className="history-title">HISTORY</span>
            <button
              className="history-close"
              onClick={() => toggle(false)}
              aria-label="Close history"
            >
              ✕
            </button>
          </header>

          {archive.length === 0 ? (
            <p className="history-empty">Nothing has been on screen yet.</p>
          ) : (
            <ul className="history-list" data-hit-rescue>
              {/* Newest first: the thing he most likely wants back is the thing
                  that just left, and making him scroll to it would defeat the
                  point of a list he opens with one hand. */}
              {[...archive].reverse().map((a) => (
                <li key={a.id}>
                  <button className="history-row" onClick={() => restore(a.id)}>
                    <span className="history-kind">{KINDS[a.kind] ?? a.kind.toUpperCase()}</span>
                    <span className="history-name">{a.title}</span>
                    <span className="history-when">{ago(a.at, now)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="history-foot">left hand, four fingers, to close</div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
