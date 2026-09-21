import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

/**
 * Put MediaPipe's WebAssembly where the page can actually load it.
 *
 * Hand tracking needs a WASM runtime, and the usual recipe fetches it from a
 * CDN. That fails here twice over. The page's CSP names no CDN in `script-src`,
 * and the runtime arrives as a script — so it is blocked, and the failure
 * surfaces as gesture control simply never starting. And a CDN import is a live
 * supply-chain dependency: executable code, re-resolved on every load, that we
 * do not control and cannot pin against being changed under us.
 *
 * Copying it out of node_modules solves both. It is served from our own origin,
 * so `'self'` covers it; and it is the exact bytes of the version in the
 * lockfile. It stays out of git — 34 MB of build output does not belong in a
 * repository — and is re-copied whenever it is missing.
 *
 * Its own file, rather than living inside start.mjs, because there are now two
 * callers. `npm start` needs it for the dev server, and `npm run build` needs
 * it as `prebuild`: a deployment builds from a clean checkout where
 * public/mediapipe has never existed, and without this step the production
 * site shipped with no hand tracking at all while working perfectly locally.
 */
export function vendorWasm() {
  const from = 'node_modules/@mediapipe/tasks-vision/wasm'
  const to = 'public/mediapipe'
  if (!existsSync(from)) return // gesture control is optional; carry on without it
  if (existsSync(`${to}/vision_wasm_internal.wasm`)) return
  try {
    mkdirSync(to, { recursive: true })
    cpSync(from, to, { recursive: true })
    console.log('  vendored the hand-tracking runtime into public/mediapipe.')
  } catch (err) {
    console.warn(`  could not vendor the hand-tracking runtime: ${err.message}`)
  }
}

// Run directly as `node scripts/vendor-wasm.mjs`, which is what prebuild does.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) vendorWasm()
