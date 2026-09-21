import { useEffect, useRef, useState } from 'react'
import { login } from '../lib/auth'

/**
 * The passphrase, asked once, before a hosted bridge will talk.
 *
 * Shown in place of INITIALISE, and only when the bridge has said it needs a
 * login; against a bridge on the owner's own PC it never appears. After one
 * success the session lasts thirty days, so this is a screen seen roughly once
 * a month per browser, not once a visit.
 *
 * A plain conditional in App, never AnimatePresence. This is a full-screen
 * fixed element that has to take pointer events for its input, which is
 * exactly the shape that has already stranded itself over the interface twice
 * in this codebase (see Ignition.tsx and Boot.tsx) and silently swallowed
 * every click and pinch.
 */
export function Gate({ onDone }: { onDone: () => void }) {
  const [pass, pass_] = useState('')
  const [error, error_] = useState<string | null>(null)
  const [busy, busy_] = useState(false)
  const box = useRef<HTMLInputElement>(null)

  useEffect(() => box.current?.focus(), [])

  const submit = async () => {
    if (!pass || busy) return
    busy_(true)
    error_(null)
    const err = await login(pass)
    busy_(false)
    if (err) {
      error_(err)
      pass_('')
      box.current?.focus()
      return
    }
    onDone()
  }

  return (
    <div className="gate">
      <form
        className="gate-card"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <span className="pk pk-tl" />
        <span className="pk pk-tr" />
        <span className="pk pk-bl" />
        <span className="pk pk-br" />

        <div className="gate-title">J.A.R.V.I.S.</div>
        <div className="gate-sub">passphrase</div>

        <input
          ref={box}
          className="gate-field"
          type="password"
          value={pass}
          onChange={(e) => pass_(e.target.value)}
          // Enter is handled explicitly: implicit form submission was seen not
          // to fire elsewhere in this interface, and a login box that ignores
          // Enter feels broken.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
          }}
          autoComplete="current-password"
          aria-label="Passphrase"
          disabled={busy}
        />

        <button className="gate-go" type="submit" disabled={!pass || busy}>
          {busy ? 'CHECKING' : 'UNLOCK'}
        </button>

        <div className="gate-error" role="alert">
          {error ?? ''}
        </div>
      </form>
    </div>
  )
}
