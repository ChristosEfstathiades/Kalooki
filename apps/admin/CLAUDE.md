# CLAUDE.md (apps/admin)

Guidance for the admin app. Repo-wide context, commands, and coding conventions are in the root `CLAUDE.md`.

The admin-only site served from `admin.{domain}` (dev: port 3001). It is a **plain Vite + React 19 SPA** — not TanStack Start, and with **no router** while it is a single view. Add a router when the tooling grows past one page; do not reach for TanStack Start here, since this app needs no SSR, no file routes and no nitro.

- **Why it is separate from `apps/frontend`:** so no admin code ships in the bundle players download, and so the two sites are separate origins with separate sessions. The security boundary is `middleware.role('admin')` on `/api/v1/admin` in the backend — the separate build is defence in depth, not the control.
- **Auth:** signs in through the shared `/api/v1/auth/login`, then refuses any account whose role is not `admin` and discards the token. Its token lives under `kalooki.admin.accessToken`, a different key from the player site's, so the two sessions never collide on `localhost` in development.
- **Backend client:** the same generated Tuyau client the frontend uses (`@KalookiOnline/backend/registry`), so the backend must be built before this app.
- **Styling:** Tailwind v4 with a small self-contained theme in `src/styles.css` — deliberately colder and denser than the player site's card-room palette so the two are never confused. Dark only. There is **no shadcn/ui here**; the local `Button` and `StatusPill` are the whole component library, and dialogs are plain fixed-position markup. Keep it that way unless the app grows enough to justify more.
- **Import alias:** `#/*` maps to `src/*`.
