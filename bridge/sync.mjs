import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { mergeArchive, mergeSeen, mergeTodos } from '../shared/merge.js'

/**
 * One JARVIS across every device he has it open on.
 *
 * Every browser that opens the site and gets past the lock is connected to
 * this bridge already, which is the whole mechanism: there is no pairing and
 * no proximity sensing. A device says hello with an id it keeps in its own
 * storage, and from then on it is on the device map, in the list a throw can
 * be aimed at, and in the audience for every change to the shared state.
 *
 * What is shared, and kept here on disk so it outlives a redeploy:
 *   - the to-do list, with tombstones for deletions (see shared/merge.js);
 *   - which weekly items have been put on the list, so no device adds twice;
 *   - the history of everything shown;
 *   - the devices themselves, their names and where he has put them on the map.
 *
 * Nothing here trusts what arrives. Every field is checked and bounded before
 * it is merged or relayed, and blade markup is sanitised again by whichever
 * browser renders it.
 */

const DIR =
  process.env.JARVIS_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(os.homedir(), '.jarvis')
const FILE = path.join(DIR, 'sync.json')

const KINDS = new Set(['laptop', 'desktop', 'phone', 'tablet'])
const BLADE_KINDS = new Set(['article', 'image', 'gallery', 'video', 'embed', 'markup'])
const SIZES = new Set(['compact', 'tall', 'wide', 'full'])
const DEVICE_ID = /^[\w-]{8,64}$/
const ITEM_ID = /^[\w.-]{1,80}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const MAX_HTML = 400_000
/** The whole store, as characters on disk; the oldest history goes first past it. */
const BUDGET = 20_000_000

export const SYNC_TYPES = new Set(['hello', 'sync', 'throw', 'device'])

const blank = () => ({ todos: [], gone: {}, seen: [], archive: [], devices: {} })

function load() {
  try {
    return { ...blank(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`[jarvis] sync: could not read ${FILE}: ${err.message}`)
    return blank()
  }
}

let state = load()

export function syncInfo() {
  const onVolume = Boolean(process.env.JARVIS_DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH)
  return { file: FILE, onVolume }
}

let saveTimer = null
function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      let json = JSON.stringify(state)
      while (json.length > BUDGET && state.archive.length > 1) {
        state.archive = state.archive.slice(Math.ceil(state.archive.length / 4))
        json = JSON.stringify(state)
      }
      fs.mkdirSync(DIR, { recursive: true })
      // Written aside and renamed into place, so a crash mid-write leaves the
      // previous copy rather than half a file.
      fs.writeFileSync(`${FILE}.tmp`, json)
      fs.renameSync(`${FILE}.tmp`, FILE)
    } catch (err) {
      console.warn(`[jarvis] sync: could not save: ${err.message}`)
    }
  }, 400)
}

/* ------------------------------------------------------------ checking input */

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : undefined)
const unit = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : undefined)
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

function cleanTodo(t) {
  if (!t || typeof t !== 'object' || !ITEM_ID.test(t.id ?? '') || typeof t.text !== 'string') return null
  const out = {
    id: t.id,
    text: t.text.slice(0, 200),
    done: t.done === true,
    due: typeof t.due === 'string' && DAY.test(t.due) ? t.due : null,
    at: num(t.at) ?? 0,
  }
  if (num(t.updatedAt) !== undefined) out.updatedAt = t.updatedAt
  if (t.assumed === true) out.assumed = true
  if (t.kind === 'setwork' || t.kind === 'response') out.kind = t.kind
  if (typeof t.subject === 'string') out.subject = t.subject.slice(0, 40)
  if (typeof t.setOn === 'string' && DAY.test(t.setOn)) out.setOn = t.setOn
  return out
}

function cleanGone(g) {
  const out = {}
  if (!g || typeof g !== 'object') return out
  for (const [id, t] of Object.entries(g).slice(0, 2000)) {
    if (ITEM_ID.test(id) && num(t) !== undefined) out[id] = t
  }
  return out
}

function cleanBlade(b) {
  if (!b || typeof b !== 'object' || !ITEM_ID.test(b.id ?? '') || !BLADE_KINDS.has(b.kind)) return null
  const out = {
    id: b.id,
    title: text(b.title, 200) ?? '',
    kind: b.kind,
    size: SIZES.has(b.size) ? b.size : 'tall',
    hold: b.hold === 'turn' ? 'turn' : 'sticky',
  }
  if (typeof b.url === 'string') out.url = b.url.slice(0, 4000)
  if (typeof b.html === 'string') out.html = b.html.slice(0, MAX_HTML)
  if (Array.isArray(b.images)) out.images = b.images.filter((u) => typeof u === 'string').slice(0, 40).map((u) => u.slice(0, 4000))
  if (b.mode === 'reader' || b.mode === 'live') out.mode = b.mode
  return out
}

function cleanArchived(a) {
  const b = cleanBlade(a)
  return b && num(a.at) !== undefined ? { ...b, at: a.at } : null
}

/* ------------------------------------------------------------------ devices */

/** socket -> device id, for every socket that has said hello. */
const clients = new Map()

const sendTo = (socket, msg) => {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
}

function deviceList() {
  const online = new Set(clients.values())
  return Object.entries(state.devices).map(([id, d]) => ({
    id,
    name: d.name,
    kind: d.kind,
    x: d.x,
    y: d.y,
    online: online.has(id),
    lastSeen: d.lastSeen,
  }))
}

function broadcastDevices() {
  const list = deviceList()
  for (const s of clients.keys()) sendTo(s, { type: 'devices', list })
}

/** A free spot on the map for a device seen for the first time. */
function freeSpot() {
  const taken = Object.values(state.devices)
  const spots = [
    [0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.18], [0.5, 0.82],
    [0.2, 0.18], [0.8, 0.18], [0.2, 0.82], [0.8, 0.82],
  ]
  const spot = spots.find(([x, y]) => taken.every((d) => Math.hypot(d.x - x, d.y - y) > 0.15)) ?? [0.5, 0.5]
  return { x: spot[0], y: spot[1] }
}

/* ----------------------------------------------------------------- messages */

export function onSyncMessage(socket, msg) {
  if (msg.type === 'hello') return hello(socket, msg)
  // Nothing else is accepted from a socket that has not said who it is.
  if (!clients.has(socket)) return
  if (msg.type === 'sync') return sync(socket, msg)
  if (msg.type === 'throw') return throwBlade(socket, msg)
  if (msg.type === 'device') return device(msg)
}

function hello(socket, msg) {
  const d = msg.device ?? {}
  if (typeof d.id !== 'string' || !DEVICE_ID.test(d.id)) return
  const prev = state.devices[d.id]
  const spot = prev ?? freeSpot()
  state.devices[d.id] = {
    // His name for it wins over the one the browser guessed.
    name: prev?.name ?? (text(d.name, 40)?.trim() || 'Device'),
    kind: KINDS.has(d.kind) ? d.kind : (prev?.kind ?? 'laptop'),
    x: spot.x,
    y: spot.y,
    lastSeen: Date.now(),
  }
  clients.set(socket, d.id)
  save()
  sendTo(socket, { type: 'sync', todos: state.todos, gone: state.gone, seen: state.seen, archive: state.archive })
  broadcastDevices()
}

function sync(socket, msg) {
  const before = JSON.stringify([state.todos, state.gone, state.seen])

  if (Array.isArray(msg.todos) || msg.gone) {
    const theirs = {
      todos: (Array.isArray(msg.todos) ? msg.todos : []).slice(0, 400).map(cleanTodo).filter(Boolean),
      gone: cleanGone(msg.gone),
    }
    const merged = mergeTodos(state, theirs)
    state.todos = merged.todos
    state.gone = merged.gone
  }
  if (Array.isArray(msg.seen)) {
    state.seen = mergeSeen(state.seen, msg.seen.filter((k) => typeof k === 'string' && k.length <= 80).slice(0, 400))
  }

  let added = []
  if (Array.isArray(msg.archive)) {
    const known = new Map(state.archive.map((a) => [a.id, a.at]))
    added = msg.archive
      .slice(0, 300)
      .map(cleanArchived)
      .filter((a) => a && !(known.get(a.id) >= a.at))
    if (added.length) state.archive = mergeArchive(state.archive, added)
  }

  const changed = JSON.stringify([state.todos, state.gone, state.seen]) !== before
  if (!changed && !added.length) {
    // Nothing new here, but the sender may be missing something the store
    // has; send the list back so it can catch up.
    if (msg.todos) sendTo(socket, { type: 'sync', todos: state.todos, gone: state.gone, seen: state.seen })
    return
  }
  save()
  const lists = { todos: state.todos, gone: state.gone, seen: state.seen }
  for (const s of clients.keys()) {
    if (s === socket) {
      if (changed) sendTo(s, { type: 'sync', ...lists })
    } else {
      sendTo(s, { type: 'sync', ...(changed ? lists : {}), ...(added.length ? { archive: added } : {}) })
    }
  }
}

/**
 * A blade thrown at another device.
 *
 * Relayed to every open tab of that device and to nothing else. The sender is
 * told either way, so a throw at a device that has just gone to sleep says
 * so rather than vanishing.
 */
function throwBlade(socket, msg) {
  const to = typeof msg.to === 'string' ? msg.to : ''
  const blade = cleanBlade(msg.blade)
  const targets = [...clients].filter(([, id]) => id === to).map(([s]) => s)
  if (!blade || !targets.length) {
    return sendTo(socket, { type: 'thrown', ok: false, to, reason: blade ? 'offline' : 'invalid' })
  }
  const from = clients.get(socket)
  for (const s of targets) sendTo(s, { type: 'catch', from, blade })
  sendTo(socket, { type: 'thrown', ok: true, to })
}

function device(msg) {
  const d = state.devices[msg.id]
  if (!d) return
  if (msg.forget === true) {
    // Only a device that is not open can be forgotten; an open one would just
    // say hello again and reappear somewhere else on the map.
    if ([...clients.values()].includes(msg.id)) return
    delete state.devices[msg.id]
  } else {
    const name = text(msg.name, 40)?.trim()
    if (name) d.name = name
    const x = unit(msg.x)
    const y = unit(msg.y)
    if (x !== undefined) d.x = x
    if (y !== undefined) d.y = y
  }
  save()
  broadcastDevices()
}

export function leaveSync(socket) {
  const id = clients.get(socket)
  if (!id) return
  clients.delete(socket)
  if (state.devices[id]) state.devices[id].lastSeen = Date.now()
  save()
  broadcastDevices()
}
