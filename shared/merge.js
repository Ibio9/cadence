/**
 * How two copies of the synced state become one.
 *
 * Used by the bridge, which keeps the copy every device syncs with, and by
 * each device when the bridge's copy arrives. The same rules on both sides is
 * what makes syncing converge: whichever order changes arrive in, every device
 * ends up holding the same list. Plain JavaScript so Node and Vite can both
 * import this one file; the types are in merge.d.ts.
 *
 * The rules are deliberately simple:
 *   - a to-do item is whichever copy changed most recently;
 *   - a deletion is remembered for sixty days as a tombstone, and beats any
 *     copy of the item older than it, so a device that was offline cannot
 *     bring a deleted item back;
 *   - history entries are only ever added, and the newest showing of each wins.
 */

/** When an item last changed. Items saved before the field existed use when they were made. */
export const stampOf = (t) =>
  typeof t?.updatedAt === 'number' ? t.updatedAt : typeof t?.at === 'number' ? t.at : 0

const KEEP_GONE_MS = 60 * 24 * 60 * 60 * 1000

export function mergeTodos(a, b, now = Date.now()) {
  const gone = {}
  for (const src of [a?.gone, b?.gone]) {
    for (const [id, t] of Object.entries(src ?? {})) {
      if (typeof t === 'number' && !(gone[id] >= t)) gone[id] = t
    }
  }
  for (const [id, t] of Object.entries(gone)) if (t < now - KEEP_GONE_MS) delete gone[id]

  const byId = new Map()
  for (const t of [...(a?.todos ?? []), ...(b?.todos ?? [])]) {
    if (!t || typeof t.id !== 'string') continue
    const prev = byId.get(t.id)
    if (!prev || stampOf(t) > stampOf(prev)) byId.set(t.id, t)
  }
  const todos = [...byId.values()]
    .filter((t) => !(gone[t.id] >= stampOf(t)))
    .sort((x, y) => (x.at ?? 0) - (y.at ?? 0) || (x.id < y.id ? -1 : 1))
    .slice(-300)
  return { todos, gone }
}

export function mergeArchive(a = [], b = [], cap = 300) {
  const byId = new Map()
  for (const e of [...a, ...b]) {
    if (!e || typeof e.id !== 'string' || typeof e.at !== 'number') continue
    const prev = byId.get(e.id)
    if (!prev || e.at > prev.at) byId.set(e.id, e)
  }
  return [...byId.values()].sort((x, y) => x.at - y.at).slice(-cap)
}

export function mergeSeen(a = [], b = [], cap = 200) {
  return [...new Set([...a, ...b])].slice(-cap)
}
