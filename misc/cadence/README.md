# Cadence

A personal operating system: an hour-by-hour timetable built from recurring rhythms,
a zero-friction capture inbox, a task pool, and Jarvis — a Claude-powered assistant
with read and write access to the whole thing.

```
cadence/
├── server/   Express + Prisma + Postgres API   → Railway
└── web/      Next.js frontend                  → Vercel
```

---

## Deploy (about 10 minutes)

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "Cadence"
gh repo create cadence --private --source=. --push
```

### 2. Railway — database + API

1. New Project → **Deploy from GitHub repo** → pick this repo.
2. In the service settings, set **Root Directory** to `server`.
3. In the same project: **New → Database → Postgres**. Railway wires `DATABASE_URL`
   into the API service automatically.
4. On the API service, open **Variables** and add:

   | Variable | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key from console.anthropic.com |
   | `CADENCE_TOKEN` | any long random string — run `openssl rand -hex 32` |
   | `CORS_ORIGIN` | your Vercel URL (fill in after step 3) |

5. Under **Settings → Networking**, click *Generate Domain*. Copy that URL.
6. Once it's deployed, seed the starter projects and rhythms:
   `railway run npm run seed` (or open the service shell and run `npm run seed`).

### 3. Vercel — frontend

1. New Project → import the same repo.
2. Set **Root Directory** to `web`.
3. Environment variables:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | your Railway domain, e.g. `https://cadence-api.up.railway.app` |
   | `NEXT_PUBLIC_CADENCE_TOKEN` | the **same** string as `CADENCE_TOKEN` |

4. Deploy, then go back to Railway and set `CORS_ORIGIN` to your Vercel URL.

That's it. The only key you paste is `ANTHROPIC_API_KEY`, and it lives on the
server only — the browser never sees it.

---

## Run locally

```bash
# terminal 1
cd server && cp .env.example .env   # fill in DATABASE_URL + ANTHROPIC_API_KEY
npm install && npx prisma migrate dev --name init && npm run seed && npm run dev

# terminal 2
cd web && cp .env.example .env.local
npm install && npm run dev
```

Open http://localhost:3000

---

## How it works

**Rhythm → Block.** A recurring commitment is a `Rhythm` — a rule, not rows.
Each date is materialised into concrete `Block`s exactly once, guarded by a
`DayStamp`. This is the part most calendar apps get subtly wrong: without the
stamp, reopening a day resurrects blocks you deleted. Editing a rhythm clears
stamps for **future** dates only, so today's plan is never yanked out from under you.

**Authorship is visible.** Every block records who created it — `template`,
`me`, or `jarvis`. Jarvis-proposed blocks render in violet, so you always know
what you didn't decide yourself. Editing one promotes it to yours.

**Jarvis sees everything.** `buildContext()` in `server/src/routes/jarvis.js`
serialises today's blocks, open gaps, inbox, tasks and your last 7 days of
completion data into every request. Every feature you add later just extends
that one function. Jarvis writes back by emitting a fenced JSON block, which
the server validates against real project ids and real open gaps before applying.

**Auth is a shared secret.** You're the only user, so there are no accounts —
just a token in a header. If you ever add a second user, that's the seam to
replace.

**The bank stocks itself.** On boot the server measures the TARA question bank
and writes whatever is missing — fifteen per subcategory, three model calls at a
time, off the request path. It tops up whenever a type drops below ten *unseen*
questions, because a hundred you have already answered twice are worth nothing
to drill against. See `server/src/tara/bank.js`.

**Retention is derived, not tracked.** Nothing writes a "topic touched" row.
`server/src/retention.js` reads the blocks you actually held and the questions
you actually answered, and runs a forgetting curve over them — so it is right
about history nothing was recording, and it cannot drift out of step with the
thing it describes. A topic is a block's own title, so it works with no tagging.
Read the header of that file before believing a number off it.

**The interview drill needs HTTPS.** Camera and microphone are gated on a secure
context, so the sitting screen works on Vercel and on `localhost`, and nowhere
else. Transcription is the browser's own Web Speech API — no audio leaves the
machine and it costs nothing; the critique is one Claude call with web search on.

## Things worth building next

- A **shutdown review** at 21:30: Jarvis walks the day, then drafts tomorrow.
- **Drag-to-resize** blocks (fractional indexing if you add ordering).
- A **pending queue** for Jarvis proposals, if writing directly starts to annoy you.
- **Energy-aware gap filling** — match `deep` tasks to your genuinely sharp hours.
