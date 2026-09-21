import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import process from 'node:process'

/**
 * The lock on a hosted bridge.
 *
 * On the owner's own PC the bridge is guarded by the Origin allowlist alone,
 * and that is enough there: only a browser can send an Origin it did not
 * choose, and nothing off the machine can reach localhost. On a public server
 * neither holds. Anyone can reach it, and any script can put whatever Origin
 * it likes on a request. Behind this socket sit the owner's Claude
 * subscription and their Gmail, so a hosted bridge must prove who is calling.
 *
 * The scheme is deliberately small:
 *
 *   - The owner sets JARVIS_PASSPHRASE on the server. It never leaves there.
 *   - POST /auth with the passphrase returns two signed tokens. They are HMACs,
 *     so the server keeps no session table and survives a restart, and a
 *     change of passphrase invalidates every token ever issued.
 *   - The SESSION token (30 days) opens the socket and authorises fetches. It
 *     travels in a WebSocket subprotocol and an Authorization header, so it
 *     never appears in a URL and never lands in an access log.
 *   - The MEDIA token (12 hours) exists only because <img> and <iframe> cannot
 *     send headers, so it must ride in a query string. It is scoped to the
 *     three read-only proxy routes and nothing else. If one leaks into a log,
 *     what leaks is twelve hours of image fetching, not the owner's inbox.
 *
 * Cookies were the obvious alternative and do not work here: the interface is
 * on mycadenceos.com and the bridge on a Railway domain, which makes any
 * cookie a third-party one, and browsers are removing those.
 */

/**
 * Hosted means reachable from the internet, and it fails safe.
 *
 * RAILWAY_ENVIRONMENT is always present on Railway, so a deployment that
 * forgot JARVIS_HOSTED still locks itself rather than running open. The risk
 * being guarded against is a public bridge with no passphrase, and an
 * explicit flag alone would make that one missing variable away.
 */
export const HOSTED =
  process.env.JARVIS_HOSTED === '1' || Boolean(process.env.RAILWAY_ENVIRONMENT)

const PASSPHRASE = process.env.JARVIS_PASSPHRASE ?? ''

/** Twelve characters is the floor; see the rate limit for why that suffices. */
const MIN_PASSPHRASE = 12

/**
 * Refuse to start a hosted bridge that has no real lock.
 *
 * Exiting beats running. A crashed service is visible in the dashboard and
 * costs nothing; a bridge that quietly accepted everyone would be discovered
 * by whoever found it first.
 */
export function assertLocked() {
  if (!HOSTED) return
  if (PASSPHRASE.length < MIN_PASSPHRASE) {
    console.error(
      `[jarvis] refusing to start: this bridge is hosted and JARVIS_PASSPHRASE is ` +
        `${PASSPHRASE ? `only ${PASSPHRASE.length} characters` : 'not set'}. ` +
        `Set it to at least ${MIN_PASSPHRASE} characters in the service's variables.`,
    )
    process.exit(1)
  }
}

// Keyed off the passphrase, so rotating it revokes every outstanding token.
const KEY = createHash('sha256').update(`jarvis-token-key:${PASSPHRASE}`).digest()

const DAY = 86_400_000
export const SESSION_TTL = 30 * DAY
export const MEDIA_TTL = DAY / 2

/** `<payload>.<mac>`, both base64url, so it is valid as a WebSocket subprotocol. */
export function sign(scope, ttlMs) {
  const body = Buffer.from(JSON.stringify({ s: scope, e: Date.now() + ttlMs })).toString(
    'base64url',
  )
  const mac = createHmac('sha256', KEY).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function verify(token, scope) {
  if (typeof token !== 'string' || token.length > 512) return false
  const dot = token.indexOf('.')
  if (dot < 1) return false
  const body = token.slice(0, dot)
  const want = createHmac('sha256', KEY).update(body).digest()
  const got = Buffer.from(token.slice(dot + 1), 'base64url')
  // Length first: timingSafeEqual throws on a mismatch rather than answering.
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return p.s === scope && typeof p.e === 'number' && p.e > Date.now()
  } catch {
    return false
  }
}

/**
 * Constant-time, over digests.
 *
 * Comparing the raw strings would leak the passphrase's length through the
 * early return, and comparing them character by character would leak how many
 * leading characters were right. Hashing both first gives two equal-length
 * buffers whatever was typed.
 */
export function passphraseMatches(given) {
  if (typeof given !== 'string' || !PASSPHRASE) return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(PASSPHRASE).digest()
  return timingSafeEqual(a, b)
}

/**
 * Guessing, bounded.
 *
 * In memory is correct here, not a shortcut: Railway runs one long-lived
 * process, so there is exactly one counter to keep. Per address it stops a
 * single machine hammering; the global ceiling stops a spread-out attempt from
 * doing the same thing from many.
 *
 * At ten tries per address and forty in total per ten minutes, a twelve-
 * character passphrase is out of reach of guessing on any timescale that
 * matters.
 */
const WINDOW = 10 * 60_000
const PER_ADDRESS = 10
const GLOBAL = 40
const attempts = new Map()
let globalCount = 0
let globalReset = Date.now() + WINDOW

export function allowAttempt(address) {
  const now = Date.now()
  if (now > globalReset) {
    globalCount = 0
    globalReset = now + WINDOW
  }
  const a = attempts.get(address)
  if (!a || now > a.reset) {
    attempts.set(address, { count: 1, reset: now + WINDOW })
  } else {
    a.count++
    if (a.count > PER_ADDRESS) return false
  }
  globalCount++
  if (globalCount > GLOBAL) return false
  // Swept on the way through so the map cannot grow without bound.
  if (attempts.size > 5000) for (const [k, v] of attempts) if (now > v.reset) attempts.delete(k)
  return true
}

/** The caller's address. Railway puts the client first in x-forwarded-for. */
export function addressOf(req) {
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
  return fwd || req.socket?.remoteAddress || 'unknown'
}

export function bearerOf(req) {
  const h = String(req.headers.authorization ?? '')
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

/** The session token offered as a subprotocol: `new WebSocket(url, ['jarvis', token])`. */
export function protocolTokenOf(req) {
  const offered = String(req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return offered.find((p) => p !== 'jarvis') ?? ''
}

/** The routes a media token may open, and only these. */
const MEDIA_ROUTES = ['/img', '/media', '/page']

export function mediaAllowed(req) {
  if (req.method !== 'GET') return false
  const url = new URL(req.url ?? '/', 'http://x')
  if (!MEDIA_ROUTES.includes(url.pathname)) return false
  return verify(url.searchParams.get('t') ?? '', 'media')
}
