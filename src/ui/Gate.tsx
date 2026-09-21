import { useEffect, useRef, useState } from 'react'
import {
  STORAGE_KEY,
  adoptStored,
  linkError,
  login,
  requestLink,
  usesPassphrase,
} from '../lib/auth'

/**
 * Signing in to a hosted bridge.
 *
 * One of two screens, and the bridge decides which. With a passphrase set it
 * is a single password box, which is what the owner asked for. Without one it
 * is a button that emails a single-use link. Never both: the bridge turns the
 * link routes off entirely while a passphrase is set.
 *
 * Either way a device stays signed in for a year, so this is seen rarely.
 *
 * A plain conditional in App, never AnimatePresence. This is a full-screen
 * fixed element that takes pointer events, which is exactly the shape that
 * has already stranded itself over the interface twice in this codebase (see
 * Ignition.tsx and Boot.tsx) and silently swallowed every click and pinch.
 */
export function Gate({ onDone }: { onDone: () => void }) {
  return usesPassphrase() ? <PasswordGate onDone={onDone} /> : <LinkGate onDone={onDone} />
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <span className="pk pk-tl" />
        <span className="pk pk-tr" />
        <span className="pk pk-bl" />
        <span className="pk pk-br" />
        <div className="gate-title">J.A.R.V.I.S.</div>
        {children}
      </div>
    </div>
  )
}

function PasswordGate({ onDone }: { onDone: () => void }) {
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
    <Frame>
      <input
        ref={box}
        className="gate-field"
        type="password"
        value={pass}
        onChange={(e) => pass_(e.target.value)}
        // Enter is handled explicitly: implicit form submission was seen not
        // to fire elsewhere in this interface.
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
        }}
        placeholder="password"
        autoComplete="current-password"
        aria-label="Password"
        disabled={busy}
      />
      <button className="gate-go" onClick={() => void submit()} disabled={!pass || busy}>
        {busy ? 'CHECKING' : 'UNLOCK'}
      </button>
      <div className="gate-error" role="alert">
        {error ?? ''}
      </div>
    </Frame>
  )
}

/**
 * The emailed link, for a bridge with no passphrase. The link usually opens
 * in a new tab, which signs itself in; this tab hears about it through the
 * storage event and moves on, so there is nothing to reload.
 */
function LinkGate({ onDone }: { onDone: () => void }) {
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
    <Frame>
      <p className="gate-note">
        {state === 'sent'
          ? 'Sent. Open the email on this device and tap the link. It works once and lasts fifteen minutes.'
          : 'Sign in with a link sent to your Gmail. Nothing to type.'}
      </p>
      <button className="gate-go" onClick={() => void send()} disabled={state === 'sending'}>
        {state === 'sending' ? 'SENDING' : state === 'sent' ? 'SEND ANOTHER' : 'EMAIL ME A SIGN-IN LINK'}
      </button>
      <div className="gate-error" role="alert">
        {error ?? ''}
      </div>
    </Frame>
  )
}
