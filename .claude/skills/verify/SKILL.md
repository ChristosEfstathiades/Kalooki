---
name: verify
description: How to run and observe Kalooki Online end-to-end on this machine — launching/reusing the dev servers, seeding users and match data, and screenshotting authed frontend pages with headless Edge over CDP.
---

# Verifying Kalooki Online changes

## Handles

- Backend API: `node ace serve --hmr` in `apps/backend`, port 3333. Frontend: `npm run dev` in `apps/frontend` (Vite, port 3000). **Check first whether they are already running** (`Get-NetTCPConnection -LocalPort 3333,3000`) — the user often has both up, and the backend HMR picks up new controllers/routes without a restart (confirm by probing the new route; 404 means restart needed). If you must restart, kill the squatting process first (see memory: port squatting) — never leave a dead watcher holding the port.
- Dev database: SQLite at `apps/backend/tmp/db.sqlite3` (better-sqlite3 in root `node_modules` — the workspace hoists it; `apps/backend/node_modules` does NOT have it). Safe to open read-write while the server runs.

## Seeding

- Create users through the real signup API (`POST /api/v1/auth/signup` with `username, email, password, passwordConfirmation`; password rules: 8+ chars, symbol, capital — `Kalooki!23` works). Response: `data.user.id` and `data.token` (bearer). Re-runs: fall back to `POST /api/v1/auth/login` with email+password.
- Recorded matches can be inserted directly into `matches` + `match_players` (they're only written when a live game ends). Timestamps as ISO strings; SQLite booleans as 0/1; `scoresheet` is a JSON array of `{ roundNumber, winnerUserId, penalties, totals }` keyed by user id.
- Prefix seeded usernames (e.g. `Lb...`) so they're identifiable/cleanable later.

## Driving the authed frontend

No Playwright in the repo. Headless Edge + raw CDP works; `ws` is in root `node_modules`:

1. Launch `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe --headless=new --remote-debugging-port=<port> --user-data-dir=<temp> --window-size=W,H http://localhost:3000/`
2. Poll `http://127.0.0.1:<port>/json/list` for a `page` target, connect to `webSocketDebuggerUrl`.
3. `Runtime.evaluate`: `localStorage.setItem('kalooki.accessToken', '<token>')` (token key from `src/lib/auth-token.ts`), then `Page.navigate` to the target route, wait ~4s for fetch+render, `Page.captureScreenshot`.

Use a dedicated debugging port (not 9222) and a throwaway profile dir to avoid clashing with the user's Edge.

## Gotchas

- Working directory resets between PowerShell calls in some harnesses — use absolute paths in `Set-Location`.
- Live two-player game flows can be driven the same way with two Edge profiles/ports and two tokens; the public queue starts on a 10s countdown at 2+ players.
