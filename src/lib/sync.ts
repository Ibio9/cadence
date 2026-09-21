import { mergeArchive, mergeSeen, mergeTodos } from '../../shared/merge.js'
import { onBridgeOpen, sendFrame, watchSync } from './bridge'
import { rememberSeen, seenKeys, useStore, type Archived, type Blade, type Device, type Todo } from '../store'

/**
 * One JARVIS across his devices: the browser half.
 *
 * Every device that is powered up is connected to the bridge already, so this
 * only has to say who it is and keep the shared lists moving. On connecting it
 * says hello and sends everything it has; the bridge merges and sends back the
 * result; from then on each change here is sent there and each change there
 * arrives here. Both sides merge by the same rules (shared/merge.js), so the
 * order things arrive in does not matter.
 *
 * Throwing is the one thing that is not a list: a blade sent to one named
 * device, which the bridge relays to it and nowhere else.
 */

type Kind = Device['kind']

const DEVICE_KEY = 'jarvis.device.v1'

/** A first guess at what this is, from the browser; he can rename it on the map. */
function guess(): { name: string; kind: Kind } {
  const ua = navigator.userAgent
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/iPhone/.test(ua)) return { name: 'iPhone', kind: 'phone' }
  if (/iPad/.test(ua) || touchMac) return { name: 'iPad', kind: 'tablet' }
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? { name: 'Android phone', kind: 'phone' } : { name: 'Android tablet', kind: 'tablet' }
  if (/CrOS/.test(ua)) return { name: 'Chromebook', kind: 'laptop' }
  if (/Macintosh/.test(ua)) return { name: 'Mac', kind: 'laptop' }
  if (/Windows/.test(ua)) return { name: 'Windows PC', kind: 'laptop' }
  return { name: 'Computer', kind: 'desktop' }
}

let me: { id: string; name: string; kind: Kind } | null = null

/** This browser, as the other devices know it. The id is kept in its storage. */
export function thisDevice() {
  if (me) return me
  try {
    const saved = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null')
    if (saved && typeof saved.id === 'string' && /^[\w-]{8,64}$/.test(saved.id)) {
      me = { id: saved.id, name: String(saved.name ?? guess().name), kind: saved.kind ?? guess().kind }
      return me
    }
  } catch {
    /* fall through to a new identity */
  }
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  me = { id: `d-${random}`, ...guess() }
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(me))
  } catch {
    /* a new identity each visit, which only costs a duplicate on the map */
  }
  return me
}

/* ---------------------------------------------------------------- the lists */

/** Set while applying what arrived, so it is not immediately sent back. */
let applying = false
/** History entries already sent this connection, as `id:at`. */
let sentArchive = new Set<string>()
const key = (a: Archived) => `${a.id}:${a.at}`

function pushLists() {
  const s = useStore.getState()
  sendFrame({ type: 'sync', todos: s.todos, gone: s.todoGone, seen: seenKeys() })
}

function pushArchive() {
  const fresh = useStore.getState().archive.filter((a) => !sentArchive.has(key(a)))
  if (fresh.length && sendFrame({ type: 'sync', archive: fresh })) fresh.forEach((a) => sentArchive.add(key(a)))
}

function applyRemote(msg: Record<string, unknown>) {
  const s = useStore.getState()
  const patch: Partial<ReturnType<typeof useStore.getState>> = {}

  if (Array.isArray(msg.todos) || msg.gone) {
    const merged = mergeTodos<Todo>(
      { todos: s.todos, gone: s.todoGone },
      { todos: (msg.todos as Todo[]) ?? [], gone: (msg.gone as Record<string, number>) ?? {} },
    )
    if (JSON.stringify(merged.todos) !== JSON.stringify(s.todos)) patch.todos = merged.todos
    if (JSON.stringify(merged.gone) !== JSON.stringify(s.todoGone)) patch.todoGone = merged.gone
  }
  if (Array.isArray(msg.seen)) rememberSeen(mergeSeen(seenKeys(), msg.seen as string[]))
  if (Array.isArray(msg.archive) && msg.archive.length) {
    const incoming = msg.archive as Archived[]
    const merged = mergeArchive<Archived>(s.archive, incoming)
    incoming.forEach((a) => sentArchive.add(key(a)))
    if (merged.length !== s.archive.length || merged.some((a, i) => key(a) !== key(s.archive[i]))) {
      patch.archive = merged
    }
  }
  if (!Object.keys(patch).length) return
  applying = true
  try {
    useStore.setState(patch)
  } finally {
    applying = false
  }
}

/* ----------------------------------------------------------------- throwing */

/** The device map is twice as wide as it is tall; directions are measured on it. */
const MAP_W = 2
const MAP_H = 1
/** How far off the line to a device a throw may be and still reach it. */
const CONE = (55 * Math.PI) / 180

const angleTo = (from: Device, to: Device) => Math.atan2((to.y - from.y) * MAP_H, (to.x - from.x) * MAP_W)
const between = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))

/**
 * The open device in the direction of a throw, if one is close enough to it.
 * Angles are screen angles, y downward, which is also how the map is laid out.
 */
export function targetFor(angle: number): Device | null {
  const { devices } = useStore.getState()
  const here = devices.find((d) => d.id === thisDevice().id)
  if (!here) return null
  let best: Device | null = null
  let off = Infinity
  for (const d of devices) {
    if (d.id === here.id || !d.online) continue
    const diff = between(angleTo(here, d), angle)
    if (diff < off) {
      best = d
      off = diff
    }
  }
  return off <= CONE ? best : null
}

/** Send a blade to whichever device is that way. Null if nothing is. */
export function throwBlade(blade: Blade, angle: number): Device | null {
  const to = targetFor(angle)
  if (!to) return null
  const { arrive: _a, from: _f, ...rest } = blade
  void _a
  void _f
  if (!sendFrame({ type: 'throw', to: to.id, blade: rest })) return null
  return to
}

/** Which edge a blade from `fromId` should arrive through, from where the two sit on the map. */
function arrivalEdge(fromId: string): Blade['arrive'] {
  const { devices } = useStore.getState()
  const here = devices.find((d) => d.id === thisDevice().id)
  const there = devices.find((d) => d.id === fromId)
  if (!here || !there) return 'top'
  const dx = (there.x - here.x) * MAP_W
  const dy = (there.y - here.y) * MAP_H
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom'
}

function caught(msg: Record<string, unknown>) {
  const blade = msg.blade as Blade | undefined
  if (!blade?.id) return
  const fromId = String(msg.from ?? '')
  const s = useStore.getState()
  const sender = s.devices.find((d) => d.id === fromId)
  // Sticky: something thrown to him is something he wants to look at.
  s.pushBlade({ ...blade, hold: 'sticky', arrive: arrivalEdge(fromId), from: sender?.name ?? 'another device' })
}

/* ------------------------------------------------------------------ the map */

/** Move a device on the map; everyone sees it. Optimistic here, confirmed by the bridge. */
export function placeDevice(id: string, x: number, y: number) {
  const s = useStore.getState()
  s.setDevices(s.devices.map((d) => (d.id === id ? { ...d, x, y } : d)))
  sendFrame({ type: 'device', id, x, y })
}

export function renameDevice(id: string, name: string) {
  const clean = name.trim().slice(0, 40)
  if (!clean) return
  if (id === thisDevice().id) {
    me = { ...thisDevice(), name: clean }
    try {
      localStorage.setItem(DEVICE_KEY, JSON.stringify(me))
    } catch {
      /* the bridge keeps the name anyway */
    }
  }
  sendFrame({ type: 'device', id, name: clean })
}

export function forgetDevice(id: string) {
  sendFrame({ type: 'device', id, forget: true })
}

/* ------------------------------------------------------------------- wiring */

let started = false

export function startSync() {
  if (started) return
  started = true

  onBridgeOpen(() => {
    sentArchive = new Set()
    sendFrame({ type: 'hello', device: thisDevice() })
    pushLists()
    pushArchive()
  })

  watchSync((msg) => {
    if (msg.type === 'devices' && Array.isArray(msg.list)) useStore.getState().setDevices(msg.list as Device[])
    else if (msg.type === 'sync') applyRemote(msg)
    else if (msg.type === 'catch') caught(msg)
    else if (msg.type === 'thrown' && msg.ok === false) {
      const to = useStore.getState().devices.find((d) => d.id === msg.to)
      useStore.getState().showNote(`${to?.name ?? 'That device'} is not open right now.`)
    }
  })

  let pending = 0
  useStore.subscribe((s, prev) => {
    if (applying) return
    if (s.todos !== prev.todos || s.todoGone !== prev.todoGone) {
      window.clearTimeout(pending)
      pending = window.setTimeout(pushLists, 300)
    }
    if (s.archive !== prev.archive) pushArchive()
  })
}
