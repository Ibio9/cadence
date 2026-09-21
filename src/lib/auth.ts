import { BRIDGE_HTTP_URL } from '../config'

/**
 * Logging in to a hosted bridge.
 *
 * A bridge on the owner's PC needs nothing from here: it reports that it is
 * open and every helper below becomes a no-op. A hosted one reports that it
 * wants a passphrase, which is traded once for two tokens (see bridge/auth.mjs
 * for why there are two and where each is allowed to travel).
 *
 * Whether a login is needed is asked of the bridge rather than configured,
 * so the same build works against either kind without a flag to forget.
 */

const KEY = 'jarvis.auth.v1'
const REFRESH_MS = 6 * 60 * 60 * 1000

/** A bridge on this machine, as opposed to one on the internet. */
const LOCAL_BRIDGE = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BRIDGE_HTTP_URL)

type Tokens = { session: string; media: string }

let tokens: Tokens | null = load()
/** The bridge said it needs a login. Unknown until probe() has answered. */
let required = false
let probed = false
let refresher = 0

function load(): Tokens | null {
  try {
    const raw = localStorage.getItem(KEY)
    const t = raw ? JSON.parse(raw) : null
    return t && typeof t.session === 'string' && typeof t.media === 'string' ? t : null
  } catch {
    return null
  }
}

function save(t: Tokens | null) {
  tokens = t
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: the tokens still work for this tab */
  }
}

/**
 * Trade the session for a fresh media token, and learn whether the session
 * is still good at the same time. A failure that is a refusal clears the
 * stored tokens; a failure that is just the network does not, because being
 * offline is not a reason to make someone type their passphrase again.
 */
async function refresh(): Promise<boolean> {
  if (!tokens) return false
  try {
    const r = await fetch(`${BRIDGE_HTTP_URL}/auth/check`, {
      headers: { authorization: `Bearer ${tokens.session}` },
    })
    if (r.status === 401) {
      save(null)
      return false
    }
    if (!r.ok) return false
    const j = await r.json()
    save({ session: tokens.session, media: String(j.media) })
    return true
  } catch {
    return false
  }
}

function keepFresh() {
  window.clearInterval(refresher)
  // The media token lasts twelve hours; refreshing at six keeps a page left
  // open overnight from showing broken images in the morning.
  refresher = window.setInterval(() => void refresh(), REFRESH_MS)
}

/**
 * What the interface should show before it offers INITIALISE.
 *
 *   'open'  — no login needed (a bridge on this PC, or one we cannot reach
 *             yet, in which case the ordinary connection error says so).
 *   'ready' — a hosted bridge, and the stored session is still valid.
 *   'login' — a hosted bridge, and we need the passphrase.
 */
export async function probe(): Promise<'open' | 'ready' | 'login'> {
  try {
    const r = await fetch(`${BRIDGE_HTTP_URL}/health`)
    required = Boolean((await r.json()).auth)
  } catch {
    /*
     * Unreachable, so the bridge cannot tell us. What to assume depends on
     * where it is. On this PC, unreachable almost always means not running,
     * and the ordinary connection error says so more usefully than a login
     * box would. A remote bridge is hosted by definition, so assume the lock
     * is on: the passphrase screen then says plainly that it cannot reach the
     * bridge, instead of offering an INITIALISE that fails at the socket.
     */
    required = !LOCAL_BRIDGE
  }
  probed = true
  if (!required) return 'open'
  if (tokens && (await refresh())) {
    keepFresh()
    return 'ready'
  }
  return 'login'
}

/** Returns null on success, or a sentence to show him. */
export async function login(passphrase: string): Promise<string | null> {
  try {
    const r = await fetch(`${BRIDGE_HTTP_URL}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return String(j.error ?? 'Could not log in.')
    save({ session: String(j.session), media: String(j.media) })
    keepFresh()
    return null
  } catch {
    return 'The bridge could not be reached.'
  }
}

export function logout() {
  window.clearInterval(refresher)
  save(null)
}

/** Safe to power on: the probe has answered and, if a login was needed, we have one. */
export const isReady = () => probed && (!required || tokens !== null)

/** For fetches to the bridge. Empty when no login is needed. */
export const authHeaders = (): Record<string, string> =>
  required && tokens ? { authorization: `Bearer ${tokens.session}` } : {}

/**
 * For the socket. A browser WebSocket cannot set headers, so the session
 * rides as the second of two subprotocols; the bridge answers with the first.
 */
export const socketProtocols = (): string[] | undefined =>
  required && tokens ? ['jarvis', tokens.session] : undefined

/**
 * For <img>, <video> and <iframe> sources, which cannot send headers either.
 * Only ever the short-lived media token — the session never goes in a URL.
 */
export function withMedia(url: string): string {
  if (!required || !tokens) return url
  return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(tokens.media)}`
}
