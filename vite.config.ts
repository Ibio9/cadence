import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Write the bridge's origin into the page's Content Security Policy.
 *
 * index.html lets images, media and frames load only from the page itself and
 * from a bridge on localhost:8787. A hosted bridge lives on another origin, and
 * everything the interface proxies through it — images in a briefing, articles
 * in a blade — would be refused by the CSP without this.
 *
 * Added by exact origin at build time, taken from the same VITE_BRIDGE_URL the
 * interface connects to, rather than widening the policy to a wildcard. A
 * local bridge adds nothing, because index.html already names it.
 *
 * connect-src is left alone: it already allows https: and wss:.
 */
function bridgeInCsp(bridgeUrl: string | undefined): Plugin {
  let origin = ''
  try {
    if (bridgeUrl) origin = new URL(bridgeUrl.replace(/^ws/, 'http')).origin
  } catch {
    origin = ''
  }
  const local = !origin || /\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin)
  return {
    name: 'jarvis-bridge-csp',
    transformIndexHtml(html) {
      if (local) return html
      return html.replace(/((?:img|media|frame)-src)([^;]*);/g, `$1$2 ${origin};`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv rather than process.env, so a local .env works as well as the
  // variables a deployment host injects.
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react(), bridgeInCsp(env.VITE_BRIDGE_URL)],
    server: {
      // Honour PORT so a second instance can run alongside the first. The bridge
      // only accepts sockets from localhost:5173-5199, so stay inside that range
      // or set JARVIS_ALLOWED_ORIGINS to match.
      port: Number(process.env.PORT) || 5173,
    },
    optimizeDeps: {
      // kokoro-js pulls in `phonemizer`, which carries espeak-ng as inline WASM.
      // Vite's dependency pre-bundler rewrites that initialisation and the
      // language table ends up empty — the symptom is
      // `Invalid language identifier: "en". Should be one of: .` at generate()
      // time, long after the model has loaded successfully. Serving these
      // untouched fixes it.
      exclude: ['kokoro-js', 'phonemizer', '@huggingface/transformers'],
    },
  }
})
