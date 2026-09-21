import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore, type Blade } from '../store'
import { BRIDGE_HTTP_URL } from '../config'
import { withMedia } from '../lib/auth'
import { sanitisePanelHtml } from './sanitise'
import { diag as handDiag, frameSpan, peaceScroll, pointScroll, throwOf } from '../lib/hands'
import { isConnected } from '../lib/bridge'
import { nearestTo, targetFor, throwBlade, way } from '../lib/sync'
import * as camera from '../lib/camera'

/**
 * The blades.
 *
 * This file used to be six slivers of light raking across the frame while a
 * tool ran — pure atmosphere, nothing you could read. That effect is still
 * here, at the bottom, because it is still the right answer to "something is
 * happening". But the name now belongs to the surface it was decorating.
 *
 * A panel is a card you glance at while listening: a figure, three headlines, a
 * status line. A blade is the thing you actually look at. The distinction is
 * not styling, it is geometry — an article you are meant to READ needs a column
 * of a particular width and a height you can scroll, and no amount of care
 * makes that work inside a 320px card stacked beside the reactor. So blades own
 * their size, they stack instead of replacing one another, and the user can
 * pull an older one forward or throw one to full screen.
 *
 * The hard problem a blade solves is that most of the web refuses to be shown.
 * X-Frame-Options and frame-ancestors stop an article being framed, CORS stops
 * the page fetching it, and hotlink protection stops even its images loading.
 * All three are rules the origin server enforces against the *browser*, so the
 * bridge takes the browser out of it: it fetches server-side and serves the
 * result from localhost, and at that point the document in the iframe is ours.
 *
 * Nothing in this file is a special case for a particular site, and nothing
 * here sniffs a file extension. The model asks `probe_url` what a thing is and
 * says what it wants shown; this only knows how to show it.
 */

/* ------------------------------------------------------------------ sources */

/**
 * Paths that are genuinely on this machine's disk, as opposed to app-relative
 * URLs that happen to start with a slash. Mirrors the test in sanitise.ts and
 * Orbits.tsx — the list of root directories is the sort of thing that should be
 * changed in each place deliberately.
 */
const DISK_PATH =
  /^\/(Users|home|root|Volumes|Applications|System|Library|private|tmp|var|opt|mnt|media|srv|data)\//

/** Route a source through the bridge, which is the only origin that can
 *  actually fetch it — and the only one the page CSP will load from. */
function viaBridge(raw: string, route: 'img' | 'media'): string {
  const src = String(raw ?? '').trim()
  if (!src) return ''
  const path = src.replace(/^file:\/\//, '')
  if (DISK_PATH.test(path)) {
    return `${BRIDGE_HTTP_URL}/file?path=${encodeURIComponent(path)}`
  }
  if (!/^https?:\/\//i.test(src)) return src
  if (src.startsWith(`${BRIDGE_HTTP_URL}/`)) return src
  // The media token, on a hosted bridge. See sanitise.ts.
  return withMedia(`${BRIDGE_HTTP_URL}/${route}?url=${encodeURIComponent(src)}`)
}

/** A whole document, rendered by the bridge so it can be framed at all. */
const pageUrl = (url: string, mode: 'reader' | 'live') =>
  withMedia(`${BRIDGE_HTTP_URL}/page?mode=${mode}&url=${encodeURIComponent(url)}`)

/**
 * The three embed hosts, and only these.
 *
 * Same closed list as the panel sanitiser, for the same reason: YouTube and
 * Vimeo will not hand over the media file, so an iframe is the only way to play
 * a result inline, and the trade for that is that the host list does not grow.
 */
function embedUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(?:www|m|music)\./, '')
  const id = (s: string) => (/^[\w-]{6,20}$/.test(s) ? s : null)

  if (host === 'youtube.com' && url.pathname === '/watch') {
    const v = id(url.searchParams.get('v') ?? '')
    return v && `https://www.youtube-nocookie.com/embed/${v}`
  }
  if (host === 'youtu.be') {
    const v = id(url.pathname.slice(1))
    return v && `https://www.youtube-nocookie.com/embed/${v}`
  }
  if (host === 'youtube-nocookie.com' && /^\/embed\/[\w-]+/.test(url.pathname)) return url.href
  if (host === 'vimeo.com') {
    const v = url.pathname.split('/').filter(Boolean)[0] ?? ''
    return /^\d+$/.test(v) ? `https://player.vimeo.com/video/${v}` : null
  }
  if (host === 'player.vimeo.com' && /^\/video\/\d+/.test(url.pathname)) return url.href
  return null
}

/* --------------------------------------------------------------------- body */

/**
 * What goes inside a blade.
 *
 * Every iframe is sandboxed. `allow-same-origin` is deliberately absent from
 * the proxied-page case: that document is served from the bridge's own origin —
 * the one origin permitted to open the agent socket — so granting it
 * same-origin would let a page JARVIS found on the web reach that socket. It
 * does not need it. It is being read, not run.
 */
/**
 * The live camera, on screen.
 *
 * Holding the camera for as long as the blade is open does two jobs. It shows
 * the user what JARVIS can see, which is the honest way to run a camera; and it
 * starts the rolling buffer, which is the only reason "what did I just do" can
 * ever be answered — a question that cannot be satisfied by starting to record
 * at the moment it is asked.
 *
 * Mirrored here and only here. A person expects their own image to behave like
 * a reflection, so the preview is flipped for them; the frames handed to the
 * model are not, because a label held up to the lens has to arrive the right
 * way round.
 */
const CameraView = memo(function CameraView() {
  const el = useRef<HTMLVideoElement>(null)
  const [failed, failed_] = useState<string | null>(null)

  useEffect(() => {
    let held = false
    let gone = false
    void camera
      .holdCamera()
      .then((source) => {
        if (gone) {
          camera.releaseCamera()
          return
        }
        held = true
        camera.startBuffer()
        if (el.current && source.srcObject) el.current.srcObject = source.srcObject
      })
      .catch((err: DOMException) =>
        failed_(
          err?.name === 'NotAllowedError'
            ? 'Camera access is not permitted.'
            : `The camera could not be opened: ${err?.message ?? err}`,
        ),
      )
    return () => {
      gone = true
      if (held) camera.releaseCamera()
    }
  }, [])

  if (failed) return <p className="bl-note">{failed}</p>
  return <video ref={el} className="bl-camera" autoPlay playsInline muted />
})

const Body = memo(function Body({ blade }: { blade: Blade }) {
  if (blade.kind === 'camera') return <CameraView />

  if (blade.kind === 'article' && blade.url) {
    return (
      <iframe
        className="bl-frame"
        src={pageUrl(blade.url, blade.mode ?? 'reader')}
        // allow-scripts WITHOUT allow-same-origin. That combination is the
        // point: the page runs in an opaque origin, so the one script the
        // bridge injects can move the document's own scroll position and can
        // reach nothing of ours — not this origin, not the agent socket. Adding
        // allow-same-origin would hand a page found on the web the keys.
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title={blade.title}
      />
    )
  }

  if (blade.kind === 'embed' && blade.url) {
    const embed = embedUrl(blade.url)
    if (!embed) return <p className="bl-note">That video link could not be played.</p>
    return (
      <iframe
        className="bl-frame"
        src={embed}
        // A player genuinely needs scripts and its own origin. Nothing that
        // reaches the room the user is sitting in is granted.
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="no-referrer"
        allowFullScreen
        title={blade.title}
      />
    )
  }

  if (blade.kind === 'video' && blade.url) {
    return (
      <video
        className="bl-video"
        src={viaBridge(blade.url, 'media')}
        controls
        playsInline
        preload="metadata"
      />
    )
  }

  if (blade.kind === 'image' && blade.url) {
    return <img className="bl-image" src={viaBridge(blade.url, 'img')} alt={blade.title} />
  }

  if (blade.kind === 'gallery') {
    return (
      <div className="bl-gallery">
        {(blade.images ?? []).map((src, i) => (
          <img key={`${src}-${i}`} className="bl-thumb" src={viaBridge(src, 'img')} alt="" />
        ))}
      </div>
    )
  }

  if (blade.kind === 'markup' && blade.html) {
    // Model-authored markup gets exactly the treatment panel markup gets.
    // There is one sanitiser, and this is it.
    return (
      <div
        className="bl-markup p-body"
        dangerouslySetInnerHTML={{ __html: sanitisePanelHtml(blade.html) }}
      />
    )
  }

  return <p className="bl-note">Nothing to show.</p>
})

/* ------------------------------------------------------------------ throwing */

/**
 * Throwing a blade to another device.
 *
 * Two ways by hand, both reliable at webcam frame rates:
 *
 *   - The OK sign: hold it on a blade (thumb and index pinched, the other
 *     three fingers up), then let go. It goes the way the index points once
 *     it is out. No speed is needed: every speed-based throw failed on a real
 *     webcam, which blurs exactly the fast movement being measured, while a
 *     held sign and a pointing finger are poses it sees sharply.
 *   - Carry it: carry the blade towards a device until that device's edge
 *     lights up, and let go.
 *
 * An ordinary pinch, fingers curled, is never a throw, so dragging blades
 * about behaves as it always has. With a mouse or a finger on glass, a flick
 * throws. Nothing is thrown unless another device is open.
 */

/** A mouse or touch movement this fast, in px per ms, is a flick. */
const FLICK = 1.1
/** How much of the hold must be the OK sign for letting go to send. */
const OK_SHARE = 0.6
/** How far a blade must be carried for a mouse flick to aim by the carry. */
const AIM_PX = 80
/**
 * Carrying a blade this far towards a device (a fifth of the screen, at least
 * 150px) lights that device's edge, and letting go while it is lit sends it.
 * Far enough that tidying a blade across the screen does not light anything;
 * the cone is tight for the same reason, so moving a blade up or down never
 * arms a device off to the side.
 */
const ARM_FRACTION = 0.2
const ARM_MIN_PX = 150
const ARM_CONE = (45 * Math.PI) / 180
/** Without the tracker's measurement, how far back from the release to look. */
const HAND_LOOKBACK_MS = 300
const FLICK_LOOKBACK_MS = 150

type Release = {
  dx: number
  dy: number
  vx: number
  vy: number
  speed: number
  pointerId: number
  snap?: number
  wide?: number
  ok?: number
  px?: number
  py?: number
}
type Sample = { t: number; x: number; y: number }

/**
 * The fastest the pointer moved, over any stretch of about 70ms ending between
 * `from` and `to`, and in which direction.
 */
function peakVelocity(trail: Sample[], from: number, to: number) {
  let best = { vx: 0, vy: 0, speed: 0 }
  for (let j = trail.length - 1; j > 0; j--) {
    if (trail[j].t > to) continue
    if (trail[j].t < from) break
    // Both ends inside the window: a stretch that merely ends in it can reach
    // back to movement from before, and count a shove that had stopped.
    let i = j
    while (i > 0 && trail[i - 1].t >= from && trail[j].t - trail[i - 1].t <= 70) i--
    const dt = trail[j].t - trail[i].t
    if (dt < 12) continue
    const vx = (trail[j].x - trail[i].x) / dt
    const vy = (trail[j].y - trail[i].y) / dt
    const speed = Math.hypot(vx, vy)
    if (speed > best.speed) best = { vx, vy, speed }
  }
  return best
}

const othersOnline = () => {
  const s = useStore.getState()
  return s.devices.filter((d) => d.online).length > 1
}

/* -------------------------------------------------------------------- card */

function Card({
  blade,
  depth,
  focused,
  expanded,
  onFocus,
  onExpand,
  onClose,
}: {
  blade: Blade
  /** 0 is front-most. Drives the offset and the dimming behind it. */
  depth: number
  focused: boolean
  expanded: boolean
  onFocus: () => void
  onExpand: () => void
  onClose: () => void
}) {
  /** Size the user has dragged this blade to, overriding the class preset. */
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  /** Where the user has dragged it, relative to its slot. */
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const shell = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  /** Whether it is full screen right now, for handlers that outlive a render. */
  const expandedNow = useRef(expanded)
  expandedNow.current = expanded

  /**
   * Scroll whatever this blade is showing.
   *
   * Two destinations, because a blade holds two different kinds of thing. Its
   * own overflow for markup and galleries; a postMessage for an article, since
   * an iframe is a separate document that the parent cannot scroll directly —
   * see the shim in bridge/page.mjs.
   */
  const scrollContent = (dy: number) => {
    const el = body.current
    if (!el) return
    const frame = el.querySelector('iframe')
    if (frame?.contentWindow) {
      frame.contentWindow.postMessage({ jarvis: 'scroll', dy }, '*')
    } else {
      el.scrollTop += dy
    }
  }

  /**
   * Drag and resize both listen on `window`, and that is the whole trick.
   *
   * The obvious implementations do not work by hand. framer-motion's own drag
   * tracks the pointer through internals we cannot reach, and the resize grip
   * originally listened on the grip element — but the hand controller aims its
   * synthetic events with elementFromPoint, and one pixel into a drag the
   * element under the cursor is no longer the grip. So resizing by hand died on
   * the first frame, and dragging never started at all.
   *
   * Listening on window fixes both for free: a synthetic event dispatched at
   * whatever is under the cursor still bubbles to window, so these handlers see
   * a hand and a mouse identically. Which is the property the gesture layer was
   * designed around — one interaction, not two implementations of it.
   */
  const grab = (
    e: React.PointerEvent,
    onMove: (dx: number, dy: number) => void,
    onRelease?: (r: Release) => void,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const sx = e.clientX
    const sy = e.clientY
    /**
     * Only the pointer that picked it up can move it or put it down.
     *
     * These listeners are on window, and with hands in view window hears every
     * hand's moves every frame, pinched or not. Taking all of them meant a
     * second hand anywhere in the picture yanked the blade to its own position
     * on alternate frames. The guard that replaced that froze the drag
     * whenever both hands read as pinched, and a resting fist often does, so
     * the blade would not move at all. Each hand has its own pointerId, so
     * following one of them removes the need for either.
     */
    const id = e.pointerId
    // The last moment of positions, for how it was moving when it was let go.
    const trail: Sample[] = [{ t: performance.now(), x: sx, y: sy }]

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      const now = performance.now()
      trail.push({ t: now, x: ev.clientX, y: ev.clientY })
      while (trail.length > 2 && now - trail[0].t > 800) trail.shift()
      onMove(ev.clientX - sx, ev.clientY - sy)
    }
    const done = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
      if (!onRelease || ev.type === 'pointercancel') return
      const last = trail[trail.length - 1]
      // A hand's own measurement, from the tracker, when it has one for this
      // grab; otherwise the pointer's last moment before release.
      const measured = id >= 9000 ? throwOf(id - 9000) : null
      const peak =
        measured && measured.at >= trail[0].t
          ? measured
          : peakVelocity(trail, last.t - (id >= 9000 ? HAND_LOOKBACK_MS : FLICK_LOOKBACK_MS), last.t)
      // Where it had been carried to when the fingers began to open. The
      // cursor rides the index fingertip, and a snap flicks that fingertip, so
      // counting movement after that moment would let the snap itself aim.
      const aimedFrom =
        measured && measured.at >= trail[0].t
          ? ([...trail].reverse().find((p) => p.t <= measured.at) ?? trail[0])
          : last
      onRelease({ dx: aimedFrom.x - sx, dy: aimedFrom.y - sy, ...peak, pointerId: id })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
  }

  const setAim = useStore((s) => s.setAim)
  const showNote = useStore((s) => s.showNote)
  const showFlash = useStore((s) => s.showFlash)
  /** Set while the blade is on its way to another device. */
  const [flying, flying_] = useState<{ x: number; y: number; spin: number } | null>(null)
  const throwable = blade.kind !== 'camera'

  /**
   * While carrying: light the edge of the device it is being carried towards,
   * once it has been carried far enough. Letting go while lit sends it.
   */
  const aimAt = (dx: number, dy: number) => {
    if (!throwable || expandedNow.current || !othersOnline()) return
    const reach = Math.max(ARM_MIN_PX, window.innerWidth * ARM_FRACTION)
    const dist = Math.hypot(dx, dy)
    const angle = Math.atan2(dy, dx)
    const lit = useStore.getState().aim
    /*
     * Once lit, it stays lit unless he clearly takes it back.
     *
     * Opening the fingers to let go moves the index fingertip, which is where
     * the cursor sits, in the beat before the release is known. Judged afresh
     * each frame, that movement could put the edge out just before the
     * release, and the blade was put down instead of sent: exactly "the edge
     * comes up, then it just moves". Hysteresis: lighting needs the full
     * carry and the tight cone; going out needs a real retreat.
     */
    if (lit) {
      const still = dist >= reach * 0.6 ? targetFor(angle, ARM_CONE * 1.6) : null
      if (still?.name === lit.name) setAim({ name: lit.name, angle })
      else setAim(null)
      return
    }
    if (dist < reach) return
    const to = targetFor(angle, ARM_CONE)
    if (to) setAim({ name: to.name, angle })
  }

  /**
   * Off it goes: accelerating away towards that device's edge, shrinking,
   * tilting and fading into it, while the edge bursts with where it went.
   */
  const launch = (angle: number, from: { x: number; y: number }) => {
    const to = throwBlade(blade, angle)
    if (!to) {
      // Say what it was read as and where the device actually is: a map laid
      // out differently from the desk shows up here at once.
      const near = nearestTo(angle)
      showNote(
        !isConnected()
          ? 'Not connected to the other devices right now; try again in a moment.'
          : near
            ? `That read as a throw ${way(angle)}, but ${near.name} is ${way(near.angle)} on the map.`
            : 'No other device is open.',
      )
      setPos(from)
      return
    }
    showFlash({ kind: 'sent', text: `Sent to ${to.name}`, angle })
    flying_({ x: Math.cos(angle) * 1500, y: Math.sin(angle) * 1500, spin: Math.cos(angle) >= 0 ? 9 : -9 })
    window.setTimeout(onClose, 600)
  }

  /** On letting go: put it down, or throw it. `from` is where it was picked up. */
  const release = (from: { x: number; y: number }) => (r: Release) => {
    // Let go while a device's edge was lit: that is the send. Nothing about
    // how the fingers opened matters; the carry already said where.
    const armed = useStore.getState().aim
    setAim(null)
    if (!throwable || expandedNow.current) return
    if (armed) {
      launch(armed.angle, from)
      return
    }
    const hand = r.pointerId >= 9000
    if (hand) {
      // The OK sign, held, then let go: sent the way the index points. Any
      // other release is putting it down. Every verdict is written down for
      // the diagnostics panel (D), so a throw that does nothing says why.
      const share = r.ok ?? 0
      const pct = Math.round(share * 100)
      const carriedFar = Math.hypot(r.dx, r.dy) >= 150
      if (r.ok === undefined) {
        handDiag.lastThrow = 'put down: the tracker had no measurement of this release'
        return
      }
      if (share < OK_SHARE) {
        handDiag.lastThrow = `put down: OK sign seen ${pct}% of the hold (needs ${OK_SHARE * 100}%)`
        // A release in place with some of the sign in it was probably meant as
        // a throw; a long drag was not, and says nothing.
        if (othersOnline() && share >= 0.15 && !carriedFar) {
          showNote(`Didn't send: saw the OK sign ${pct}% of the time you held it (needs ${OK_SHARE * 100}%). Keep your middle, ring and little fingers up.`)
        }
        return
      }
      if (!othersOnline()) {
        handDiag.lastThrow = 'OK sign, but no other device is open'
        showNote('No other device is open. Power JARVIS up on the other one first.')
        return
      }
      const px = r.px ?? 0
      const py = r.py ?? 0
      if (Math.hypot(px, py) < 1) {
        handDiag.lastThrow = 'OK sign, but the index was not seen pointing anywhere'
        return
      }
      const angle = Math.atan2(py, px)
      handDiag.lastThrow = `OK sign ${pct}%, index pointing ${way(angle)}: sending`
      launch(angle, from)
      return
    }

    // A mouse or a finger on glass: a flick, aimed the way it was carried or
    // failing that the way it was moving.
    if (r.speed < FLICK) return
    if (!othersOnline()) {
      showNote('No other device is open. Power JARVIS up on the other one first.')
      return
    }
    launch(Math.hypot(r.dx, r.dy) >= AIM_PX ? Math.atan2(r.dy, r.dx) : Math.atan2(r.vy, r.vx), from)
  }

  const onHeadDown = (e: React.PointerEvent) => {
    // Buttons live in the header too; starting a drag from one would mean the
    // click never lands.
    if ((e.target as HTMLElement).closest('button')) return
    if (!focused) onFocus()
    // Full screen, a grab brings it back out to be moved, instead of doing
    // nothing: a blade sent over from another device arrives full screen, and
    // with this returning early it could not be moved, resized or sent back.
    if (expanded) onExpand()
    const from = { ...pos }
    grab(
      e,
      (dx, dy) => {
        setPos({ x: from.x + dx, y: from.y + dy })
        aimAt(dx, dy)
      },
      release(from),
    )
  }

  /**
   * Pinch anywhere on a blade to grab it.
   *
   * This used to scroll, and moving a blade was possible only by hitting the
   * header — a strip 31 pixels tall. Asking someone to land a hand cursor on 31
   * pixels is not an interaction, and since a pinch on the body scrolled
   * instead, there was in practice no way to move a blade by hand at all.
   *
   * Grabbing is also what people try first: you see a thing and reach for it.
   * So a pinch anywhere picks the blade up, and scrolling moves to a pose that
   * is deliberate and hard to make by accident — two fingers, see the effect
   * below. Only for 'touch', which is what the gesture layer dispatches; a mouse
   * keeps its wheel and its ability to select text.
   */
  const onBodyDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    if (!focused) onFocus()
    if (expanded) onExpand()
    const from = { ...pos }
    grab(
      e,
      (dx, dy) => {
        setPos({ x: from.x + dx, y: from.y + dy })
        aimAt(dx, dy)
      },
      release(from),
    )
  }

  /**
   * Two fingers up, moved up or down, scrolls the front blade.
   *
   * Reads a distance from hands.ts and decides here that it means scrolling —
   * the tracker publishes the pose, not the consequence.
   */
  useEffect(() => {
    if (!focused) return
    let raf = 0
    let last: number | null = null
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const travelled = peaceScroll()
      if (travelled === null) {
        last = null
        return
      }
      if (last === null) {
        last = travelled
        return
      }
      // Inverted and amplified: pulling your hand up moves you down the page,
      // and a hand does not have the travel a scroll wheel does.
      scrollContent((last - travelled) * 2.4)
      last = travelled
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [focused])

  /**
   * One finger does the same thing, if it is pointing at the blade.
   *
   * Two fingers was the only way to scroll, and it is an awkward pose to hold
   * through a long briefing. The reason it was chosen is still real though:
   * one finger is the cursor, so an unconditional one-finger scroll would drag
   * the page every time he aimed at anything.
   *
   * The bounds test is what resolves it. Scrolling only happens while the
   * fingertip is inside this blade's body, which is exactly when "scroll this"
   * is the only thing the gesture could mean. Aiming at a tab, at the history,
   * or at empty space leaves it alone.
   *
   * Gentler than the two-finger figure. That is a pose adopted deliberately in
   * order to scroll and wants the travel; this is also the resting pose of a
   * hand aimed at something, so it earns less movement per pixel.
   */
  useEffect(() => {
    if (!focused) return
    let raf = 0
    let last: number | null = null
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const p = pointScroll()
      const el = body.current
      if (!p || !el) {
        last = null
        return
      }
      const r = el.getBoundingClientRect()
      const inside = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
      if (!inside) {
        last = null
        return
      }
      if (last === null) {
        last = p.travelled
        return
      }
      scrollContent((last - p.travelled) * 1.6)
      last = p.travelled
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [focused])

  /**
   * Frame the blade with both hands to resize it.
   *
   * Index up, thumb out, one hand either side — the rectangle people already
   * mime when they frame a shot. Pull the corners apart and the blade grows;
   * bring them together and it shrinks; lean toward the camera and it grows
   * too, because leaning in enlarges everything about the hands including the
   * gap between them.
   *
   * This replaced a two-handed pinch, which read well on paper and collided
   * badly in practice: a pinch is how you GRAB a blade, so two of them meant
   * two hands each trying to pick something up while also asking to resize it.
   * The framing pose collides with nothing, which is most of why it is right.
   *
   * The measurement arrives as a plain distance; that it means a resize is
   * decided here. Only the focused blade, and never while expanded, where the
   * size is the entire point of the state.
   */
  useEffect(() => {
    if (!focused || expanded) return
    let raf = 0
    let from: { span: number; w: number; h: number } | null = null
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const span = frameSpan()
      if (span === null) {
        from = null
        return
      }
      const box = shell.current?.getBoundingClientRect()
      if (!box) return
      if (!from) {
        // Both hands have just closed. Anchor on the size as it is now.
        from = { span, w: box.width, h: box.height }
        return
      }
      // Guard the divisor: hands almost touching would send the scale to
      // infinity and the blade off the screen in one frame.
      const k = span / Math.max(from.span, 40)
      setSize({
        w: Math.max(280, Math.min(window.innerWidth * 0.96, from.w * k)),
        h: Math.max(180, Math.min(window.innerHeight * 0.94, from.h * k)),
      })
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [focused, expanded])

  const onGrip = (e: React.PointerEvent) => {
    const box = shell.current?.getBoundingClientRect()
    if (!box) return
    const from = { w: box.width, h: box.height }
    grab(e, (dx, dy) =>
      setSize({
        w: Math.max(280, Math.min(window.innerWidth * 0.96, from.w + dx)),
        h: Math.max(180, Math.min(window.innerHeight * 0.94, from.h + dy)),
      }),
    )
  }

  /**
   * Resize from the bottom-right grip.
   *
   * Pointer capture rather than window listeners: the pointer spends most of a
   * resize over an <iframe>, and an iframe swallows mousemove from the parent
   * document entirely. Without capture the blade stops resizing the instant the
   * cursor crosses into the article it is showing, which is precisely where it
   * always crosses.
   */
  return (
    /**
     * Two elements, because two different things want the transform.
     *
     * The outer one carries the depth offset — the small lift and scale that
     * makes the stack read as objects rather than as a list. The inner one is
     * what the user drags. Framer owns `transform` on anything it animates, so
     * with both jobs on one element the drag and the stack animation overwrite
     * each other every frame and the blade jitters back to its slot.
     */
    <motion.div
      className="bl-slot"
      // Thrown here from another device, it flies in from that device's side.
      initial={
        blade.arrive
          ? {
              opacity: 0,
              scale: 0.45,
              rotate: blade.arrive === 'left' ? -9 : 9,
              filter: 'blur(6px) brightness(1.4)',
              ...(blade.arrive === 'left'
                ? { x: -1100 }
                : blade.arrive === 'right'
                  ? { x: 1100 }
                  : blade.arrive === 'top'
                    ? { y: -800 }
                    : { y: 800 }),
            }
          : { opacity: 0, y: 26, scale: 0.96, filter: 'blur(6px)' }
      }
      animate={{
        rotate: 0,
        opacity: expanded || depth === 0 ? 1 : Math.max(0.3, 1 - depth * 0.24),
        y: expanded ? 0 : depth * -13,
        x: expanded ? 0 : depth * 15,
        scale: expanded ? 1 : 1 - depth * 0.035,
        filter: depth === 0 || expanded ? 'blur(0px)' : `blur(${depth * 0.7}px)`,
      }}
      exit={{ opacity: 0, y: 18, filter: 'blur(8px)', transition: { duration: 0.28 } }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      style={{ zIndex: expanded ? 60 : 40 - depth }}
    >
      <motion.section
        ref={shell}
        className={
          `bl bl-${blade.size}` +
          (expanded ? ' bl-expanded' : '') +
          (focused ? ' bl-front' : '') +
          (flying ? ' bl-flying' : '')
        }
        // Position and size are ours rather than framer's — see `grab` above for
        // why. Applied as a plain transform because the depth animation lives on
        // the slot wrapper, so nothing is competing for this element's own one.
        style={{
          ...(size && !expanded ? { width: size.w, height: size.h } : null),
          transform: expanded
            ? undefined
            : `translate(${pos.x + (flying?.x ?? 0)}px, ${pos.y + (flying?.y ?? 0)}px)` +
            (flying ? ` scale(0.45) rotate(${flying.spin}deg)` : ''),
        }}
        // pointerdown, not mousedown: a hand dispatches PointerEvents, and a
        // mousedown handler simply never hears them. Focusing a blade by pinch
        // was silently impossible until this changed.
        onPointerDown={() => {
          if (!focused) onFocus()
        }}
      >
        <span className="pk pk-tl" />
        <span className="pk pk-tr" />
        <span className="pk pk-bl" />
        <span className="pk pk-br" />

        <header className="bl-head" onPointerDown={onHeadDown}>
          <span className="bl-title">{blade.title}</span>
          <span className="bl-kind">{blade.from ? `from ${blade.from}` : blade.kind}</span>
          <span className="bl-acts">
            {(size || pos.x || pos.y) && !expanded && (
              <button
                className="bl-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setSize(null)
                  setPos({ x: 0, y: 0 })
                }}
                title="Back where it started"
              >
                ⤾
              </button>
            )}
            <button
              className="bl-btn"
              onClick={(e) => {
                e.stopPropagation()
                onExpand()
              }}
              title={expanded ? 'Shrink (E)' : 'Full screen (E)'}
            >
              {expanded ? '⤡' : '⤢'}
            </button>
            <button
              className="bl-btn"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              title="Close (X)"
            >
              ✕
            </button>
          </span>
        </header>

        <div className="bl-body" ref={body} onPointerDown={onBodyDown}>
          <Body blade={blade} />
        </div>

        {/* Resize grip. Absent while expanded, where the size is the point. */}
        {!expanded && <span className="bl-grip" onPointerDown={onGrip} title="Drag to resize" />}
      </motion.section>
    </motion.div>
  )
}

/* ------------------------------------------------------------------- stack */

export function Blades() {
  const blades = useStore((s) => s.blades)
  const focusedBlade = useStore((s) => s.focusedBlade)
  const expandedBlade = useStore((s) => s.expandedBlade)
  const focusBlade = useStore((s) => s.focusBlade)
  const expandBlade = useStore((s) => s.expandBlade)
  const closeBlade = useStore((s) => s.closeBlade)

  /**
   * Newest first, then whichever the user pulled forward lifted to the front.
   *
   * Ordered here rather than in the store because it is a view concern, and the
   * store's array order is the history — which is what makes "the one before
   * that" a meaningful thing to ask for.
   */
  const ordered = useMemo(() => {
    const newestFirst = [...blades].reverse()
    if (!focusedBlade) return newestFirst
    const hit = newestFirst.findIndex((b) => b.id === focusedBlade)
    if (hit <= 0) return newestFirst
    const copy = [...newestFirst]
    const [lifted] = copy.splice(hit, 1)
    return [lifted, ...copy]
  }, [blades, focusedBlade])

  const front = ordered[0]

  const cycle = useCallback(
    (by: number) => {
      if (ordered.length < 2) return
      const at = ordered.findIndex((b) => b.id === front?.id)
      const next = ordered[(at + by + ordered.length) % ordered.length]
      if (next) focusBlade(next.id)
    },
    [ordered, front, focusBlade],
  )

  // Bound here rather than in App, and only while something is open, so E and X
  // are free for anything else the moment the last blade closes.
  const live = useRef(false)
  live.current = blades.length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!live.current) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return

      if (e.key === 'e') {
        e.preventDefault()
        expandBlade(expandedBlade ? null : (front?.id ?? null))
      } else if (e.key === 'x') {
        e.preventDefault()
        if (front) closeBlade(front.id)
      } else if (e.key === ']') {
        e.preventDefault()
        cycle(1)
      } else if (e.key === '[') {
        e.preventDefault()
        cycle(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [front, expandedBlade, expandBlade, closeBlade, cycle])

  if (!blades.length) return null

  return (
    <div className={`blades-stack${expandedBlade ? ' blades-stack-full' : ''}`}>
      <AnimatePresence>
        {ordered.map((blade, i) => {
          const expanded = expandedBlade === blade.id
          // While one is expanded it is the only thing on screen; the rest are
          // unmounted rather than hidden so their iframes stop loading.
          if (expandedBlade && !expanded) return null
          return (
            <Card
              key={blade.id}
              blade={blade}
              depth={expanded ? 0 : i}
              focused={blade.id === front?.id}
              expanded={expanded}
              onFocus={() => focusBlade(blade.id)}
              onExpand={() => expandBlade(expanded ? null : blade.id)}
              onClose={() => closeBlade(blade.id)}
            />
          )
        })}
      </AnimatePresence>

      {blades.length > 1 && !expandedBlade && (
        <div className="bl-hint">
          <kbd>[</kbd> <kbd>]</kbd> cycle · <kbd>E</kbd> full · <kbd>X</kbd> close
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------ aim and notes */

/**
 * While a blade is being carried towards another device, the edge of the
 * screen facing it lights and names it, so the throw is aimed rather than
 * hoped for. Also carries the one-line notes a throw leaves behind.
 */
export function ThrowAim() {
  const aim = useStore((s) => s.aim)
  const note = useStore((s) => s.note)
  const flash = useStore((s) => s.flash)

  /** The point near the screen's edge in a direction, and which edge that is. */
  const edgePoint = (angle: number, margin: number) => {
    const w = window.innerWidth
    const h = window.innerHeight
    const cx = Math.cos(angle)
    const cy = Math.sin(angle)
    const t = Math.min(
      Math.abs(cx) > 1e-3 ? (w / 2 - margin) / Math.abs(cx) : Infinity,
      Math.abs(cy) > 1e-3 ? (h / 2 - margin) / Math.abs(cy) : Infinity,
    )
    const edge = Math.abs(cx) * h >= Math.abs(cy) * w ? (cx < 0 ? 'left' : 'right') : cy < 0 ? 'top' : 'bottom'
    return { left: w / 2 + cx * t, top: h / 2 + cy * t, edge }
  }

  const armed = aim ? edgePoint(aim.angle, 90) : null
  const burst = flash ? edgePoint(flash.angle, 110) : null

  return (
    <>
      {armed && aim && (
        <>
          <div className={`throw-edge throw-edge-${armed.edge}`} />
          <div className="throw-aim" style={{ left: armed.left, top: armed.top }}>
            <span className="throw-arrow" style={{ transform: `rotate(${aim.angle}rad)` }}>
              →
            </span>
            Let go to send to {aim.name}
          </div>
        </>
      )}
      {burst && flash && (
        <div key={flash.at}>
          <div className={`throw-burst throw-burst-${burst.edge} throw-burst-${flash.kind}`} />
          <div className="throw-flash" style={{ left: burst.left, top: burst.top }}>
            <span className="throw-flash-mark">{flash.kind === 'sent' ? '✓' : '⇤'}</span>
            {flash.text}
          </div>
        </div>
      )}
      <AnimatePresence>
        {note && (
          <motion.div
            className="throw-note"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
          >
            {note}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
