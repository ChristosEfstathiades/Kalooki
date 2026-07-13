# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo is building **Kalooki Online** — a website for playing the multiplayer card game Kalooki (aka Kaluki), a Rummy-family game popular in the UK, Jamaica, and Cyprus. Users need an account to play, and can play public matches against strangers (fixed classic ruleset) or private matches with friends (customisable rules). Games run in real time over websockets. The site also has content pages (how to play/rules, tips and tricks, contact/support, privacy policy), friends, private groups with group chat, a global chatroom, and match history.

The codebase is a Turborepo monorepo (npm workspaces) with two apps:
- **`apps/backend`** — an AdonisJS 7 (next-major/experimental) HTTP API using Lucid ORM, token-based auth, and Tuyau for generating a type-safe client. Started from an AdonisJS API starter kit.
- **`apps/frontend`** — a **TanStack Start + React 19** app that consumes the backend via the generated Tuyau client. Kept separate so future mobile/desktop apps can reuse the same API.

### Database
- **Development:** SQLite
- **Production:** Postgres

### Product docs (source of truth)
Product and design intent live in `docs/` — consult and keep these in sync when working on features:
- `docs/Overview.md` — high-level product summary and how the docs fit together.
- `docs/features.md` — user accounts, friends, private groups, global chat, match history, game modes.
- `docs/Kalooki.md` — full game rules, scoring, timers/disconnect handling, and custom-rule options for private games.
- `docs/Architecture.md` — frontend/backend split, auth, realtime, DB.
- `docs/Coding-Conventions.md` — coding conventions (summarised below).
- `docs/Frontend-design.md` — UI/UX direction, theme/colours, and per-page layout.

### Auth & signup
Accounts require an email, a unique username, and a password (min 8 chars, ≥1 symbol and ≥1 capital) plus confirmation. Avatars are DiceBear "bottts" robots generated from the username — there is no photo upload. Email verification is enforced **only in production**; in development accounts are active immediately. Signin offers a "remember me" option. Only authenticated users can play, and players must not be able to see other players' hidden state (e.g. opponents' cards).

## Commands

Root scripts run through Turbo across all workspaces; per-app scripts run inside `apps/backend`.

| Task | From repo root | Inside `apps/backend` |
| --- | --- | --- |
| Dev server (HMR) | `npm run dev` | `node ace serve --hmr` |
| Build | `npm run build` | `node ace build` |
| Tests | `npm test` | `node ace test` |
| Lint | `npm run lint` | `eslint .` |
| Typecheck | `npm run typecheck` | `tsc --noEmit` |
| Format | `npm run format` | `prettier --write .` |

- `turbo test` depends on `build` — the schema/registry generation must run before tests.
- Run a subset of tests with Japa filters, e.g. `node ace test --files="user"`, `--groups="..."`, `--tags="..."`. Suites are `unit` (`tests/unit/**/*.spec.ts`) and `functional` (`tests/functional/**/*.spec.ts`).
- Ace is the CLI for everything else: `node ace list` to see commands, `node ace make:controller`, `node ace migration:run`, etc.
- Requires Node >= 24 and npm 11.

Frontend scripts run inside `apps/frontend` (also driven by Turbo from root): `npm run dev` (Vite on port 3000), `npm run build`, `npm test` (Vitest), `npm run lint` (ESLint), `npm run format` (Prettier + eslint --fix). Route generation: `npm run generate-routes` (`tsr generate`).

## Architecture

### Generated schema, hand-written models
`app/models/*.ts` do **not** declare columns. Instead, `database/schema.ts` is **auto-generated from migrations** (marked DO NOT EDIT) and exports one `*Schema` base class per table with all `@column` definitions. Models compose from these:

```ts
export default class User extends compose(UserSchema, withAuthFinder(hash)) { ... }
```

**After changing a migration, run `node ace migration:run` to regenerate `database/schema.ts`.** Add validation constraints tied to the schema in `database/schema_rules.ts`. To change a column, edit the migration — not the generated schema.

### Init hooks generate the client (`adonisrc.ts`)
Two init hooks run on boot/build:
- `indexEntities({ transformers: { enabled: true } })` — indexes controllers/transformers into `#generated/*` (`.adonisjs/server/`).
- `generateRegistry()` (Tuyau) — emits the type-safe client under `.adonisjs/client/`, exported from `package.json` as `@KalookiOnline/backend/data` and `/registry` for frontend apps to consume.

Routes reference controllers through the generated registry, not direct imports:
```ts
import { controllers } from '#generated/controllers'
router.post('signup', [controllers.NewAccount, 'store'])
```

### Response shape: `ctx.serialize()` + transformers
`providers/api_provider.ts` augments `HttpContext` with a `serialize()` method (and `serialize.withoutWrapping()`) backed by a custom `ApiSerializer`. **All responses are wrapped under a `data` key** and paginated Lucid results get standardized metadata. Controllers shape model output through `BaseTransformer` subclasses in `app/transformers/` before serializing:
```ts
return serialize({ user: UserTransformer.transform(user), token: ... })
```

### Auth: two guards
`config/auth.ts` defines `api` (opaque access tokens via `DbAccessTokensProvider`, the **default** guard, stateless) and `web` (session). Signup/login mint an access token (`User.accessTokens.create`). Protected routes use the named `auth()` middleware; `silent_auth_middleware` runs globally to populate the user when a token is present without forcing auth.

### Routing & middleware
- Routes live in `start/routes.ts`, grouped under `/api/v1` with `auth`/`account` sub-groups.
- Middleware stack is in `start/kernel.ts`. Notable: `force_json_response_middleware` forces JSON responses (this is an API, not a web app), plus CORS, session, shield, and auth-init in the router stack.

### Import aliases
Subpath imports (`#controllers/*`, `#models/*`, `#validators/*`, `#transformers/*`, `#generated/*`, `#database/*`, etc.) are defined in `apps/backend/package.json` `imports`. Use these rather than relative paths.

### Validation
VineJS validators in `app/validators/`, consumed in controllers via `request.validateUsing(...)`. Shared field rules (email/password) are factored into helper functions.

### Frontend (`apps/frontend`)
- **Stack:** TanStack Start (SSR via Nitro) + TanStack Router, React 19, Vite. Data fetching via TanStack Query; forms via TanStack Form; validation with Zod.
- **Routing:** file-based routes in `src/routes/` (`__root.tsx` is the shell). `routeTree.gen.ts` is **generated** by `tsr generate` — do not edit it by hand. Router/query setup lives in `src/router.tsx` and `src/integrations/tanstack-query/`.
- **UI:** Tailwind CSS v4 (configured in `src/styles.css`, not a `tailwind.config`) with shadcn/ui components (new-york style, `zinc` base colour, CSS variables) in `src/components/ui/`, built on Radix UI with `lucide-react` icons. Add components per `components.json`.
- **Backend client:** `@tuyau/core` consumes the type-safe client the backend generates.
- **Import aliases:** `#/*` and `@/*` both map to `src/*`.
- Much of the current `src/` (about page, `demo.*` files, demo routes) is starter scaffolding to be replaced with real Kalooki UI per `docs/Frontend-design.md`.

### Realtime
Real-time gameplay and chat run over **Socket.IO**, attached to the AdonisJS HTTP server. Chosen for its rooms/namespaces (one room per match / group chat / global chat), built-in auto-reconnect (pairs with the 5-minute rejoin timer), and ack callbacks for server-validated moves. The socket handshake carries the API token, and a socket only joins rooms it's authorized for — a player never receives opponents' hidden state. See `docs/Architecture.md`.

### File storage
Avatars are DiceBear "bottts" robots generated on the frontend from the username (`@dicebear/core` + `@dicebear/collection` in `apps/frontend/src/lib/avatar.ts`), so nothing is uploaded or stored. If user-supplied images return later, they can start on local disk and move to an object store (e.g. S3) without changing the API contract.

> Note: email sending (for production email verification) is intentionally deferred — verification is production-only and its transport is not yet wired.

## Coding conventions

From `docs/Coding-Conventions.md`:
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes and **React component files** (e.g. `Header.tsx`). Exception: shadcn/ui primitives keep the lowercase filenames the CLI generates (e.g. `button.tsx`). Backend files use `snake_case`. Prefer longer, descriptive names when they materially improve readability.
- **Imports:** always use the subpath aliases (`#controllers/*`, `#models/*`, …), never relative paths.
- **TypeScript:** no `any` (only where genuinely tolerated), avoid non-null assertions (`!`), and give exported functions explicit return types.
- **React:** function components only, with a separate `interface` for props; keep state flat; build with reusable components.
- **Comments:** doc-style comments on functions; inline explanatory comments 3 lines or less. Write descriptive error messages with proper error handling.
- **Styling:** TailwindCSS, using Tailwind variables for repeated colours.
