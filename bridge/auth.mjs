import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import process from 'node:process'

/**
 * The lock on a hosted bridge, with nothing for the owner to type.
 *
 * On the owner's own PC the bridge is guarded by the Origin allowlist alone,
 * and that is enough there: only a browser can send an Origin it did not
 * choose, and nothing off the machine can reach localhost. On a public server
 * neither holds. Anyone can reach it and any script can forge an Origin, and
 * behind this socket sit the owner's Claude subscription and his whole inbox.
 *
 * SIGNING IN IS AN EMAILED LINK, not a passphrase.
 *
 *   - Pressing "email me a sign-in link" makes the bridge send one message,
 *     to the owner's own address, holding a single-use link valid for fifteen
 *     minutes. Anyone can press the button; only the inbox owner can use what
 *     it sends. That is the whole security argument, and it is a strong one.
 *   - Opening the link trades it for a SESSION token (a year) and a MEDIA
 *     token (twelve hours). The session opens the socket and authorises
 *     fetches, travelling only as a WebSocket subprotocol and an Authorization
 *     header, so it never sits in a URL or an access log. The media token
 *     exists because <img> and <iframe> cannot send headers; it is scoped to
 *     the read-only proxy routes, so leaking one leaks image fetching.
 *
 * THERE IS NO EXTRA SECRET. The signing key is derived from the credentials
 * the bridge already needs — the Claude token and the Gmail app password — so
 * nobody has to invent, store or paste another one, and rotating either of
 * those revokes every session ever issued. That is also the "sign me out
 * everywhere" button.
 *
 * Tokens are HMACs, so the server keeps no session table and survives a
 * restart. The one piece of state is the set of spent sign-in links, which is
 * what makes each one single-use.
 */

/**
 * Hosted means reachable from the internet, and it fails safe.
 *
 * RAILWAY_ENVIRONMENT is always present on Railway, so a deployment that
 * forgot JARVIS_HOSTED still locks itself rather than running open.
 */
export const HOSTED =
  process.env.JARVIS_HOSTED === '1' || Boolean(process.env.RAILWAY_ENVIRONMENT)

const CLAUDE_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? ''
const GMAIL_ADDRESS = (process.env.JARVIS_GMAIL_ADDRESS ?? '').trim()
const GMAIL_APP_PASSWORD = (process.env.JARVIS_GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, '')

/**
 * An optional passphrase, as well as the emailed link.
 *
 * The owner asked for one and chose it himself. No minimum length is imposed,
 * because that choice is his to make; the costs of a short one are recorded
 * here so they are not forgotten. It is one guess away for anyone who thinks
 * of it, and it guards the whole inbox. The rate limit below stops blind
 * guessing, not a good guess. The emailed link stays available alongside it.
 */
const PASSPHRASE = process.env.JARVIS_PASSPHRASE ?? ''
export const PASSPHRASE_ENABLED = PASSPHRASE.length > 0

/**
 * Refuse to start a hosted bridge that could not lock itself.
 *
 * Without the Gmail pair there is no way to deliver a sign-in link, and
 * without the Claude token there is nothing to think with — and the signing
 * key is derived from all three. Exiting beats running: a crashed service is
 * visible in the dashboard and costs nothing, while a bridge that quietly let
 * everyone in would be discovered by whoever found it first.
 */
export function assertLocked() {
  if (!HOSTED) return
  const missing = [
    !CLAUDE_TOKEN && 'CLAUDE_CODE_OAUTH_TOKEN',
    !GMAIL_ADDRESS && 'JARVIS_GMAIL_ADDRESS',
    !GMAIL_APP_PASSWORD && 'JARVIS_GMAIL_APP_PASSWORD',
  ].filter(Boolean)
  if (missing.length) {
    console.error(
      `[jarvis] refusing to start: this bridge is hosted and cannot lock itself ` +
        `without ${missing.join(', ')}. Add ${missing.length > 1 ? 'them' : 'it'} ` +
        `in the service's variables.`,
    )
    process.exit(1)
  }
}

// Derived, with separators so no two different inputs can produce one key.
const KEY = createHash('sha256')
  .update(`jarvis-token-key:v2\0${CLAUDE_TOKEN}\0${GMAIL_APP_PASSWORD}\0${GMAIL_ADDRESS}\0${PASSPHRASE}`)
  .digest()

const DAY = 86_400_000
export const SESSION_TTL = 365 * DAY
export const MEDIA_TTL = DAY / 2
export const LINK_TTL = 15 * 60_000

/** `<payload>.<mac>`, both base64url, so it is valid as a WebSocket subprotocol. */
export function sign(scope, ttlMs, extra = {}) {
  const body = Buffer.from(JSON.stringify({ s: scope, e: Date.now() + ttlMs, ...extra })).toString(
    'base64url',
  )
  const mac = createHmac('sha256', KEY).update(body).digest('base64url')
  return `${body}.${mac}`
}

/** The payload if the token is genuine, unexpired and of this scope; otherwise null. */
function open(token, scope) {
  if (typeof token !== 'string' || token.length > 1024) return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const body = token.slice(0, dot)
  const want = createHmac('sha256', KEY).update(body).digest()
  const got = Buffer.from(token.slice(dot + 1), 'base64url')
  // Length first: timingSafeEqual throws on a mismatch rather than answering.
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return p.s === scope && typeof p.e === 'number' && p.e > Date.now() ? p : null
  } catch {
    return null
  }
}

export const verify = (token, scope) => open(token, scope) !== null

/**
 * Constant-time, over digests: comparing the raw strings would leak the
 * passphrase's length through the early return, and a character-by-character
 * compare would leak how much of a guess was right.
 */
export function passphraseMatches(given) {
  if (!PASSPHRASE_ENABLED || typeof given !== 'string') return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(PASSPHRASE).digest()
  return timingSafeEqual(a, b)
}

/** A fresh single-use sign-in token for the emailed link. */
export const signLink = () => sign('link', LINK_TTL, { n: randomBytes(12).toString('base64url') })

/**
 * Spend a sign-in link. True exactly once per link.
 *
 * The spent set is in memory, which is correct on a single long-lived
 * process. A restart forgets it, but a link only lives fifteen minutes, so
 * that window is the most a restart could reopen.
 */
const spent = new Map()
export function redeemLink(token) {
  const p = open(token, 'link')
  if (!p || typeof p.n !== 'string') return false
  const now = Date.now()
  for (const [n, exp] of spent) if (exp < now) spent.delete(n)
  if (spent.has(p.n)) return false
  spent.set(p.n, p.e)
  return true
}

/**
 * Counters, per address and overall.
 *
 * In memory is correct here, not a shortcut: Railway runs one process, so
 * there is exactly one counter to keep. Per address stops one machine; the
 * global ceiling stops a spread-out attempt from doing the same from many.
 */
function limiter(perAddress, overall, windowMs) {
  const seen = new Map()
  let total = 0
  let totalReset = Date.now() + windowMs
  return (address) => {
    const now = Date.now()
    if (now > totalReset) {
      total = 0
      totalReset = now + windowMs
    }
    const a = seen.get(address)
    if (!a || now > a.reset) seen.set(address, { count: 1, reset: now + windowMs })
    else if (++a.count > perAddress) return false
    if (++total > overall) return false
    if (seen.size > 5000) for (const [k, v] of seen) if (now > v.reset) seen.delete(k)
    return true
  }
}

/**
 * Sending a link costs the owner an email, so it is kept scarce: three an
 * address and eight in total per hour. Enough for every device he owns, and
 * too few for anyone to fill his inbox.
 */
export const allowLinkRequest = limiter(3, 8, 60 * 60_000)

/**
 * Passphrase guesses: five an address per ten minutes, twenty in total an
 * hour. At that rate trying every three-letter lowercase word takes over a
 * month. It does nothing against someone who simply guesses right first time.
 */
export const allowPassphrase = limiter(5, 20, 60 * 60_000)

/** Redeeming is cheap to refuse, but still bounded. */
export const allowRedeem = limiter(20, 100, 10 * 60_000)

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
