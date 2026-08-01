# SECTiON

A local-first-feeling novel writing and reading web app, now backed by a real
Node/Express server and SQLite database, ready to deploy to Railway.

## Features

- **Library** — browse your novels, see chapter counts, jump back into writing
- **Editor** — write chapters with autosave (saves ~1s after you stop typing)
- **Reader** — distraction-free reading view with copy protection and progress tracking
- **Accounts** — register, log in, or continue as a guest (no email required)

## Stack

- **Backend:** Node.js + Express 5
- **Database:** SQLite via `better-sqlite3` (file-based, zero external services)
- **Auth:** Server-side sessions (`express-session`) + PBKDF2 password hashing
- **Frontend:** Vanilla HTML/CSS/JS (no build step) — same visual design as the original mockup

## Local development

```bash
npm install
cp .env.example .env
# edit .env and set a real SESSION_SECRET
npm start
```

The app runs at `http://localhost:3000`. The SQLite database is created automatically
at `./data/section.db` on first run.

## Project structure

```
server/
  app.js               # Express app entry point
  db/index.js           # SQLite connection + schema
  middleware/requireAuth.js
  routes/
    auth.js              # register, login, logout, guest, /me
    novels.js             # novel CRUD
    chapters.js            # chapter CRUD (nested under novels)
    progress.js             # reading progress tracking
  utils/
    password.js            # PBKDF2 hash/verify
    validate.js             # input validation helpers
public/
  index.html             # single HTML shell, client-side routed
  css/main.css             # styles (same design system as the original mockup)
  js/
    api.js                  # fetch wrapper for the backend API
    app.js                   # routing + page logic (library/editor/reader/login)
```

## Deploying to Railway

1. Push this project to a GitHub repo.
2. Create a new Railway project from that repo — `railway.json` is already configured
   to use Nixpacks and run `npm start`.
3. In Railway's project settings, add environment variables:
   - `SESSION_SECRET` — any long random string
   - `NODE_ENV` — `production`
4. Railway's filesystem is ephemeral on redeploys by default. For the SQLite database
   to persist across deploys, attach a **Railway Volume** and mount it at, e.g., `/data`,
   then set `DATA_DIR=/data` as an environment variable.

## Notes / things to know

- The word counter splits on whitespace, which works fine for space-separated languages
  but only approximates for Thai (no native word boundaries). It's accurate enough for
  a progress indicator but not a precise Thai word count.
- Reader-page copy protection (disabled selection, right-click, Ctrl+C) is a client-side
  deterrent, not real DRM — a determined reader can always view source. This matches
  what the original mockup implied ("การคัดลอกเนื้อหาถูกปิดใช้งานในหน้านี้").
- Sessions are cookie-based and stored server-side in memory by default via
  `express-session`. For production with multiple server instances, swap in a session
  store like `connect-sqlite3` or Redis — the current setup is fine for a single instance.
