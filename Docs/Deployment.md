# Hosting & Deployment Plan

How to take Kalooki Online from local XAMPP development to a live, production deployment. This plan reflects the code as it stands: a Turborepo monorepo with an AdonisJS 7 backend (HTTP + Socket.IO, Postgres in production) and a TanStack Start SPA frontend.

> Cross-references: `docs/Architecture.md` (system split), `AUDIT.md` (security/scalability findings that gate launch), `apps/backend/CLAUDE.md` (build/generation steps).

---

## 1. TL;DR (recommended setup)

| Component | Recommendation | Why |
| --- | --- | --- |
| Backend API + Socket.IO | **One always-on Node instance** (Railway / Render / Fly.io, or a small VPS) | Holds all live game state in memory and terminates websockets; cannot be serverless or multi-instance today (see [§3](#3-constraints-that-shape-hosting)) |
| Database | **Managed Postgres** | Code already supports `DB_CONNECTION=pg`; managed service handles backups/patching |
| Frontend | **Static SPA on a CDN** (Cloudflare Pages / Netlify) | Built as a SPA; ships as static assets with an index fallback |
| Admin app | **Second static site on the same CDN** | `apps/admin` is a separate Vite SPA so no admin code ships to players |
| Email (verification) | **Transactional SMTP provider** (Resend / Postmark / SES) | Production signup is a hard blocker until email verification is wired ([§8](#8-launch-blockers)) |
| TLS / DNS | Provider-managed certs, one apex + two subdomains | e.g. `kalooki.app` (frontend), `api.kalooki.app` (backend), `admin.kalooki.app` (admin) |

Two concrete paths are described in [§4](#4-choose-a-hosting-path): **Path A** (managed PaaS, fastest to launch) and **Path B** (single VPS with Docker Compose, cheapest and most control). Both are viable; Path A is recommended for the first launch.

---

## 2. What we are deploying

The monorepo produces two independently deployable artifacts:

1. **Backend** (`apps/backend`) - an AdonisJS 7 HTTP server that also attaches a Socket.IO server to the same Node HTTP server. It is a **stateful, long-lived process**: live matches, lobbies, the public matchmaking queue, chat rate-limit counters, and the `@adonisjs/limiter` store all live in in-process memory. It talks to Postgres via Lucid.

2. **Frontend** (`apps/frontend`) - a TanStack Start app compiled by Vite 8. It is configured as a **SPA** (`tanstackStart({ spa: { enabled: true } })` in `vite.config.ts`), so it renders client-side and can be served as static assets. It calls the backend over HTTP (Tuyau client) and opens a Socket.IO connection, both pointed at `VITE_API_URL`.

3. **Admin app** (`apps/admin`) - a plain Vite + React SPA for `admin.{domain}`, built to `dist/`. It calls the same backend at `VITE_API_URL` over HTTP only (no websocket). Kept separate so admin code never ships in the player bundle; the security boundary is the `role('admin')` middleware on the API, not the separate build.

```
                    ┌─────────────────────────┐
   Browser  ─────▶  │  Frontend (static SPA)  │   CDN / static host
                    └─────────────────────────┘
       │  HTTPS + WSS (VITE_API_URL)
       ▼
   ┌──────────────────────────────────────┐        ┌──────────────────┐
   │  Backend: AdonisJS HTTP + Socket.IO   │ ─────▶ │  Managed Postgres │
   │  single Node process, in-memory state │        └──────────────────┘
   └──────────────────────────────────────┘
       │
       ▼
   Transactional email (verification, production only)
```

---

## 3. Constraints that shape hosting

These are load-bearing. Choose a host that satisfies them rather than working around them.

1. **Single process only (dominant constraint).** There is no Socket.IO adapter (e.g. Redis) and no externalized game state (`AUDIT.md` SC1). Running two instances or a Node cluster would split rooms and game state, breaking live games. **Run exactly one backend instance.** Horizontal autoscaling must be disabled.

2. **Websockets require persistent connections.** The backend cannot run on request/response serverless platforms (Vercel/Netlify Functions, Lambda). It needs a container or VM that keeps a process alive and allows WebSocket upgrades. Any reverse proxy in front must proxy the `Upgrade`/`Connection` headers.

3. **Every restart destroys live games.** In-memory matches are lost on deploy or crash, and mid-match state is not persisted (`AUDIT.md` SC1, G5). Deploys should be scheduled for quiet periods and, ideally, drain gracefully. Treat each deploy as "all current games end."

4. **In-memory rate limiting.** `@adonisjs/limiter` uses the memory store, which is consistent only within one process, reinforcing the single-instance rule.

5. **Node >= 24.** Root `package.json` sets `"engines": { "node": ">=24.0.0" }`. Pin the runtime to Node 24.

6. **Monorepo build order.** `turbo test` depends on `build`, and the backend generates its schema, entity index, and Tuyau client on build. The frontend imports the generated client (`@KalookiOnline/backend/registry`), so **the backend must be built before the frontend**.

7. **Native module in the dependency tree.** `better-sqlite3` (dev DB) is a runtime dependency and compiles native code, so the build image needs `python3`, `make`, and a C++ toolchain even though production uses `pg`.

---

## 4. Choose a hosting path

### Path A - Managed PaaS (recommended for launch)

Lowest operational burden; provider handles TLS, health checks, restarts, and Postgres.

| Piece | Service (examples) | Notes |
| --- | --- | --- |
| Backend | Railway, Render, or Fly.io - single service, **1 instance, autoscaling off** | Deploy from repo or a Docker image; set the build to run only the backend workspace |
| Database | The same platform's managed Postgres, or Neon / Supabase | Copy connection details into the `PG_*` env vars |
| Frontend | Cloudflare Pages or Netlify (static) | Build `apps/frontend`, publish the SPA output, add an index fallback |

Trade-off: simplest and quickest, slightly higher monthly cost than a VPS, and you accept the platform's constraints.

### Path B - Single VPS with Docker Compose (cheapest, most control)

One small VM (Hetzner CX / DigitalOcean droplet, ~2 vCPU / 2-4 GB) running everything behind a reverse proxy that terminates TLS.

```
VPS
├── Caddy (or nginx)         TLS + reverse proxy, proxies WSS upgrades
│     ├── kalooki.app        ──▶ serves frontend static build
│     └── api.kalooki.app    ──▶ backend :3333
├── backend container        node build/bin/server.js  (1 replica)
└── postgres container       or a managed Postgres instead, for backups
```

Caddy gives automatic Let's Encrypt certificates and is websocket-friendly by default. Trade-off: you own OS patching, backups, and monitoring. If you keep Postgres on the same box, set up automated `pg_dump` backups off-host.

### Decision

Start with **Path A** to get live fast with managed backups and TLS. Move to **Path B** only if cost or control becomes the priority. Both keep the backend as a single instance, so neither locks you in.

---

## 5. Component plans

### 5.1 Database (Postgres)

1. Provision a managed Postgres 16+ instance (or the Postgres container in Path B).
2. Create a database and a least-privilege application user.
3. Set the backend env: `DB_CONNECTION=pg` plus `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DB_NAME` (see `config/database.ts`).
4. Enable automated daily backups and verify a restore at least once.
5. Run migrations on every deploy, before the new process serves traffic:
   ```bash
   node ace migration:run --force
   ```
   The generated `database/schema.ts` is produced at build time from migrations (`apps/backend/CLAUDE.md`), so no manual schema step is needed.

### 5.2 Backend service

**Build** (produces a self-contained `build/` directory):
```bash
# from apps/backend, with all workspace deps installed
node ace build
cd build
npm ci --omit=dev
```

**Run** (single instance):
```bash
node ace migration:run --force   # apply migrations first
node bin/server.js                # starts HTTP + Socket.IO on $PORT/$HOST
```

Operational settings:
- **Instances: 1. Autoscaling: off.** (See [§3](#3-constraints-that-shape-hosting).)
- **Health check:** point the platform at a lightweight route. If none exists yet, add a `GET /health` returning `200`. Do not health-check a DB-heavy route.
- **Graceful shutdown:** AdonisJS handles `SIGTERM`. Because live matches are lost on restart, give the platform a generous drain timeout and deploy during low traffic. A future improvement is snapshotting `GameState` to the DB on shutdown (`AUDIT.md` SC1 recommendation).
- **Bind:** `HOST=0.0.0.0` and `PORT` from the platform's injected value.
- **Logs:** `LOG_LEVEL=info`; ship stdout to the platform's log drain.

### 5.3 Frontend (SPA)

**Build:**
```bash
# backend must be built first so the generated Tuyau client exists
npm run build            # from repo root (Turbo builds backend then frontend)
# or, targeted:  turbo build --filter=frontend
```
Set `VITE_API_URL` **at build time** (Vite inlines `import.meta.env`), e.g. `VITE_API_URL=https://api.kalooki.app`.

**Serve** - two options, both fine because the app is a SPA:
- **Static + CDN (recommended):** publish the client build output (the Nitro build emits static assets under `.output/public`) to Cloudflare Pages / Netlify with a **catch-all rewrite to `index.html`** so client-side routes resolve on hard refresh.
- **Nitro Node server:** run the Nitro output (`node .output/server/index.mjs`) as a small service if you prefer a server process over static hosting.

Add security headers at the edge (host config): a **Content-Security-Policy** (`AUDIT.md` S5) such as
```
default-src 'self'; connect-src 'self' https://api.kalooki.app wss://api.kalooki.app; img-src 'self' data:; style-src 'self' 'unsafe-inline'
```
plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and HSTS. Validate the CSP against the real app (DiceBear avatars are generated client-side, so no external image host is required).

### 5.4 Admin app (SPA)

**Build** (after the backend, like the frontend, since it imports the generated client):
```bash
turbo build --filter=admin      # with VITE_API_URL set; output in apps/admin/dist
```

Publish `apps/admin/dist` as a second static site on `admin.kalooki.app`, with the same index fallback. Two things to get right:

- **CORS must list this origin too.** The backend's allowlist needs both `https://kalooki.app` and `https://admin.kalooki.app`, or every admin request fails preflight (this is the same S6 gap as the main frontend, now with a second origin).
- **Keep it out of search.** The page ships `<meta name="robots" content="noindex, nofollow">`; add `X-Robots-Tag: noindex` at the edge as well, and consider putting the site behind an IP allowlist or access proxy, since it is an internal tool with no public purpose. No websocket connection is needed, so the CSP `connect-src` only needs the HTTPS origin.

**Bootstrapping the first admin.** Roles are granted from the admin site, which needs an admin to sign in with, so the first one is set from the command line on the backend host:
```bash
node ace user:role <username-or-email> admin
```

### 5.5 DNS & TLS

- `kalooki.app` -> frontend host.
- `api.kalooki.app` -> backend instance.
- `admin.kalooki.app` -> admin static site.
- Use provider-managed certificates (PaaS) or Caddy/Let's Encrypt (VPS). Force HTTPS and upgrade websockets to `wss://`.

### 5.6 Email (production only)

Email verification is enforced only in production and its transport is not yet built (`CLAUDE.md`, `AUDIT.md` G1). Before opening public signups:
1. Choose a transactional provider (Resend, Postmark, or Amazon SES).
2. Verify the sending domain (SPF, DKIM, DMARC).
3. Wire the verification flow: single-use, expiring, unguessable tokens and a verify endpoint, with the resend endpoint rate-limited.

Until this exists, either keep signups closed or gate launch on it. This is a **hard blocker**, not a nice-to-have.

---

## 6. Environment variables

### Backend (`apps/backend`, validated in `start/env.ts`)

| Variable | Production value | Notes |
| --- | --- | --- |
| `NODE_ENV` | `production` | Enables email verification enforcement and prod CORS behaviour |
| `HOST` | `0.0.0.0` | Bind for containers |
| `PORT` | platform-injected | e.g. `3333` |
| `LOG_LEVEL` | `info` | |
| `APP_KEY` | 32+ char secret | Generate with `node ace generate:key`; store as a platform secret |
| `APP_URL` | `https://api.kalooki.app` | |
| `SESSION_DRIVER` | `cookie` | API is token-based; session guard is largely unused |
| `DB_CONNECTION` | `pg` | Switches Lucid to Postgres |
| `PG_HOST` / `PG_PORT` | from managed DB | |
| `PG_USER` / `PG_PASSWORD` | from managed DB | Secret |
| `PG_DB_NAME` | from managed DB | |
| `TZ` | `UTC` | |
| `CORS_ORIGIN` | `https://kalooki.app,https://admin.kalooki.app` | **Currently not read by the code** - see [§8](#8-launch-blockers). Must cover the admin origin too. Wire it up before launch. |

### Frontend (`apps/frontend`, build-time)

| Variable | Production value | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `https://api.kalooki.app` | Base URL for both HTTP (Tuyau) and Socket.IO (`src/lib/api.ts`, `src/lib/socket.ts`). Inlined at build time. |

### Admin app (`apps/admin`, build-time)

| Variable | Production value | Notes |
| --- | --- | --- |
| `VITE_API_URL` | `https://api.kalooki.app` | Base URL for HTTP only; the admin app opens no websocket. Inlined at build time. |

Never commit real secrets. `apps/backend/.env` stays untracked (confirmed in `AUDIT.md`); production values live in the platform's secret store.

---

## 7. Build & deploy pipeline (CI/CD)

Suggested flow (GitHub Actions or the platform's native pipeline):

1. **Install:** `npm ci` at the repo root (workspaces).
2. **Verify:** `npm run lint`, `npm run typecheck`, `npm test` (Turbo runs `build` first, as tests depend on it).
3. **Build backend:** `turbo build --filter=@KalookiOnline/backend` (generates schema + Tuyau client).
4. **Build the SPAs:** `turbo build --filter=frontend --filter=admin` with `VITE_API_URL` set. Must run after step 3 so the generated client is available.
5. **Deploy backend:** ship `apps/backend/build`, run `node ace migration:run --force`, then start `node bin/server.js`. Single instance.
6. **Deploy frontend:** publish the static build to the CDN, purge cache.
7. **Deploy admin app:** publish `apps/admin/dist` to `admin.kalooki.app`, purge cache.

Sequence migrations before switching traffic to the new backend build. Since games are in-memory, there is no need for zero-downtime rollovers; a brief restart is acceptable and expected.

### Container sketch (Path B / any Docker platform)

Backend `Dockerfile` (multi-stage; note the native-build toolchain for `better-sqlite3`):
```dockerfile
# ---- build ----
FROM node:24-bookworm AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++   # for better-sqlite3
COPY . .
RUN npm ci
RUN npx turbo build --filter=@KalookiOnline/backend
WORKDIR /app/apps/backend/build
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /app/apps/backend/build ./
ENV NODE_ENV=production HOST=0.0.0.0
EXPOSE 3333
CMD ["sh", "-c", "node ace migration:run --force && node bin/server.js"]
```

Reverse proxy must forward websocket upgrades. Caddy does this by default:
```
api.kalooki.app {
    reverse_proxy backend:3333
}
kalooki.app {
    root * /srv/frontend
    try_files {path} /index.html      # SPA fallback
    file_server
}
admin.kalooki.app {
    root * /srv/admin
    try_files {path} /index.html      # SPA fallback
    header X-Robots-Tag "noindex"
    file_server
}
```

---

## 8. Launch blockers

Resolve these before a public production launch. All are current-code gaps surfaced in `AUDIT.md`.

- [ ] **Email verification (G1, High).** Production signup dead-ends without it. Wire mail transport + verify flow, or keep signups closed.
- [ ] **HTTP CORS is empty in production (S6, Medium).** `config/cors.ts` uses `origin: []` in prod and never reads the documented `CORS_ORIGIN` env var, so the deployed frontend's browser requests will fail preflight. Read `CORS_ORIGIN` in `config/cors.ts` and set it to the frontend **and admin** origins. Do **not** paper over this with `origin: true`.
- [ ] **Socket.IO CORS open in production (S2, High).** `socket_service.ts` sets `cors: { origin: true, credentials: true }` unconditionally. Drive it from the same allowlist as the HTTP CORS config.
- [ ] **Frontend CSP / security headers (S5, Medium).** Add at the edge (see [§5.3](#53-frontend-spa)).
- [ ] **`APP_KEY`** generated and stored as a secret; **Postgres credentials** provisioned.
- [ ] **Backups** enabled and a restore tested.
- [ ] **HTTPS forced** and websockets on `wss://`.
- [ ] Confirm the CSPRNG shuffle and other Medium findings are acceptable for launch, or fix (`AUDIT.md` S3, S4).

---

## 9. Scaling & future work

Today the ceiling is one machine (vertical scaling only). When that is no longer enough, the path to horizontal scale is documented in `AUDIT.md` SC1:

1. **Add a Socket.IO Redis adapter** so rooms fan out across instances.
2. **Externalize game state** (Redis, or snapshot `GameState` to Postgres) so any instance can serve any match; `GameState` is already a plain serializable object.
3. **Move rate limiting to a shared store** (Redis) instead of in-memory.
4. **Partition matches by id** across processes if a single shared store becomes the bottleneck.

Also worth doing early even at single-instance scale:
- Graceful-shutdown snapshotting so deploys stop killing live games.
- Cache the leaderboard (short TTL) or maintain incremental per-user stats (`AUDIT.md` SC2), since it is recomputed from the full match table per request.
- Error and uptime monitoring (the Vite config already externalizes `@sentry/*`, so Sentry is a natural fit), plus DB metrics and log retention.

---

## 10. First-deployment runbook

A concrete order of operations for the initial go-live (Path A):

1. Register the domain and create DNS records (frontend apex, `api` subdomain, `admin` subdomain).
2. Provision managed Postgres; note the connection details.
3. Create the backend service (1 instance, autoscaling off, Node 24). Set all backend env vars from [§6](#6-environment-variables) as secrets. Set `NODE_ENV=production`.
4. Deploy the backend; confirm `node ace migration:run --force` succeeds and the process stays up. Hit the health route.
5. Configure the transactional email provider and complete the verification flow (blocker G1), or launch with signups closed.
6. Fix and deploy the CORS wiring (S6 + S2) with `CORS_ORIGIN` = the frontend and admin origins.
7. Build the frontend with `VITE_API_URL=https://api.kalooki.app`; publish static output with an index fallback and the CSP headers.
8. Build and publish the admin app to `admin.kalooki.app` (index fallback, `X-Robots-Tag: noindex`), then create the first admin on the backend host with `node ace user:role <username> admin`.
9. Smoke test end to end over HTTPS: sign up (or seed a verified user), sign in, open a match, confirm the websocket connects (`wss://`), play a turn, send chat. Sign into the admin site and confirm a non-admin account is refused there.
10. Verify a Postgres backup/restore.
11. Turn on monitoring/alerting, then announce.

---

*Last updated: 2026-07-20. Keep this in sync with `docs/Architecture.md` and `AUDIT.md` as the realtime/state model evolves.*
