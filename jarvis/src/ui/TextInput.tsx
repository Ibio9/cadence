import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'

/**
 * Typing, for when talking is the wrong thing to do.
 *
 * A voice assistant that can only be spoken to is unusable in the places he
 * actually works: a classroom, a library, a room with someone else in it. The
 * microphone stays exactly as it was and this sits beside it, so a turn can
 * start either way and the transcript cannot tell the difference.
 *
 * Hidden until he has powered up, because before that the only thing to do is
 * press INITIALISE, and a text box next to it invites him to type into a
 * machine that is not listening yet.
 *
 * Enter sends. Escape hands the keyboard back, which matters because App's
 * shortcuts are bare single letters and they are suppressed for as long as
 * this holds focus.
 */
export function TextInput({ onSend }: { onSend: (text: string) => void }) {
  const phase = useStore((s) => s.phase)
  const [text, text_] = useState('')
  const box = useRef<HTMLInputElement>(null)

  const live = phase !== 'offline' && phase !== 'boot'

  // Slash focuses the box from anywhere, the way it does in every other tool
  // he uses. Registered here rather than in App because the ref lives here,
  // and skipped when he is already typing so a slash can be typed.
  useEffect(() => {
    if (!live) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key !== '/' || e.repeat) return
      e.preventDefault()
      box.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live])

  const send = () => {
    const said = text.trim()
    if (!said) return
    text_('')
    onSend(said)
  }

  return (
    <AnimatePresence>
      {live && (
        <motion.form
          className="typebar"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ type: 'spring', stiffness: 240, damping: 30 }}
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          {/* A single rule under the field, drawn as an element so it can
              animate its width from the centre on focus. A bordered box was
              the wrong shape: nothing else on this screen is a filled
              rectangle at rest, so it read as a browser widget lying on top of
              the instrument rather than part of it. */}
          <span className="typebar-rule" />

          <input
            ref={box}
            className="typebar-field"
            value={text}
            onChange={(e) => text_(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                box.current?.blur()
              }
              // Explicit, not left to the form's implicit submission, which is
              // conditional and was observed not firing. Losing a typed line
              // to a key that visibly did nothing is the worst failure a text
              // box has.
              if (e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
            placeholder="type, or press /"
            aria-label="Type a message to JARVIS"
            autoComplete="off"
            spellCheck={false}
          />
          {/* Appears only when there is something to send. A permanent SEND
              button is a second thing to aim at for a key he is already
              pressing, and at rest it was the loudest element on the screen. */}
          <button
            className={text.trim() ? 'typebar-send typebar-send-on' : 'typebar-send'}
            type="submit"
            tabIndex={text.trim() ? 0 : -1}
            aria-hidden={!text.trim()}
            aria-label="Send"
          >
            ↵
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
