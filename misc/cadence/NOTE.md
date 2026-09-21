# Cadence, archived

Archived on 21 September 2026, when JARVIS replaced Cadence at the root of this
repository and on www.mycadenceos.com. Moved here rather than deleted.

Nothing in this folder was changed. The move was made with `git mv`, so the
full history of every file is still reachable (use `git log --follow`).

## What is here

| Path | What it was | Where it ran |
|---|---|---|
| `web/` | The Cadence front end, a Next.js app (`cadence-web`) | Vercel project `cadence`, root directory `web` |
| `server/` | The Cadence API, Node with Prisma (`cadence-server`) | Railway, `cadence-production-cbb6.up.railway.app` |
| `README.md` | The Cadence readme | |
| `.gitignore` | The Cadence ignore rules | |

## What changed outside this folder

- The Vercel project `cadence` had its root directory changed from `web` to
  the repository root, and its framework from Next.js to Vite, so that
  www.mycadenceos.com now serves JARVIS.
- Railway was **not** changed. It deployed from `server/`, which has moved, so
  its next build will fail. The deployment already running keeps running on
  its last successful build, and its database is untouched. Once you are sure
  you no longer need the Cadence API, remove or pause the service in Railway.

## To put Cadence back

1. Move `web/`, `server/`, `README.md` and `.gitignore` back to the root.
2. In Vercel, set project `cadence` back to root directory `web` and
   framework Next.js.
3. Railway will build from `server/` again once it exists.
