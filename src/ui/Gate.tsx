import { useEffect, useState } from 'react'
import { STORAGE_KEY, adoptStored, linkError, requestLink } from '../lib/auth'

/**
 * Signing in to a hosted bridge: one button, nothing to type.
 *
 * Pressing it has the bridge email a single-use link to the owner's own
 * inbox. Opening that link signs the device in for a year. Shown in place of
 * INITIALISE, and only when the bridge has said it needs a sign-in; against a
 * bridge on the owner's own PC it never appears.
 *
 * The link usually opens in a new tab. That tab signs in by itself; this one
 * hears about it through the storage event and moves on, so there is nothing
 * to reload.
 *
 * A plain conditional in App, never AnimatePresence. This is a full-screen
 * fixed element that takes pointer events, which is exactly the shape that
 * has already stranded itself over the interface twice in this codebase (see
 * Ignition.tsx and Boot.tsx) and silently swallowed every click and pinch.
 */
export function Gate({ onDone }: { onDone: () => void }) {
  const [state, state_] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, error_] = useState<string | null>(linkError())

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && adoptStored()) onDone()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [onDone])

  const send = async () => {
    if (state === 'sending') return
    state_('sending')
    error_(null)
    const err = await requestLink()
    if (err) {
      error_(err)
      state_('idle')
      return
    }
    state_('sent')
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <span className="pk pk-tl" />
        <span className="pk pk-tr" />
        <span className="pk pk-bl" />
        <span className="pk pk-br" />

        <div className="gate-title">J.A.R.V.I.S.</div>

        {state === 'sent' ? (
          <p className="gate-note">
            Sent. Open the email on this device and tap the link. It works once and lasts fifteen
            minutes.
          </p>
        ) : (
          <p className="gate-note">Sign in with a link sent to your Gmail. Nothing to type.</p>
        )}

        <button className="gate-go" onClick={() => void send()} disabled={state === 'sending'}>
          {state === 'sending'
            ? 'SENDING'
            : state === 'sent'
              ? 'SEND ANOTHER'
              : 'EMAIL ME A SIGN-IN LINK'}
        </button>

        <div className="gate-error" role="alert">
          {error ?? ''}
        </div>
      </div>
    </div>
  )
}
