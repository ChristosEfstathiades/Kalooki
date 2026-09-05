# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo is building **Kalooki Online** — a website for playing the multiplayer card game Kalooki (aka Kaluki), a Rummy-family game popular in the UK, Jamaica, and Cyprus. Users need an account to play, and can play public matches against strangers (fixed classic ruleset) or private matches with friends (customisable rules). Games run in real time over websockets. The site also has content pages (how to play/rules, tips and tricks, contact/support, privacy policy), friends, private groups with group chat, a global chatroom, and match history.

The codebase is a Turborepo monorepo (npm workspaces) with three apps:
- **`apps/backend`** — an AdonisJS 7 (next-major/experimental) HTTP API using Lucid ORM, token-based auth, and Tuyau for generating a type-safe client. Started from an AdonisJS API starter kit.
- **`apps/frontend`** — a **TanStack Start + React 19** app that consumes the backend via the generated Tuyau client. Kept separate so future mobile/desktop apps can reuse the same API.
- **`apps/admin`** — a plain Vite + React 19 SPA for `admin.{domain}`, the admin-only site. Separate from the frontend so no admin code ships in the player bundle.

### Product docs (source of truth)
Product and design intent live in `Docs/` — consult and keep these in sync when working on features:
- `Docs/Overview.md` — high-level product summary and how the docs fit together.
- `Docs/features.md` — user accounts, friends, private groups, global chat, match history, game modes.
- `Docs/Kalooki.md` — full game rules, scoring, timers/disconnect handling, and custom-rule options for private games.
- `Docs/Architecture.md` — frontend/backend split, auth, realtime, DB.
- `Docs/Coding-Conventions.md` — coding conventions (summarised below).
- `Docs/Frontend-design.md` — UI/UX direction, theme/colours, and per-page layout.

### Engineering notes
`Developer/` holds working notes rather than product intent — the answers to "how do I do this here":
- `Developer/Commands.md` — command cheat sheet, including **which `migration:rollback` flags destroy the entire database** (`--batch=0`, and a bare rollback after a fresh setup). Read it before running any rollback.
- `Developer/AUDIT.md` — security/robustness audit with numbered findings (`G1`, `SC1`, …) that route and provider comments cite by id.
- `Developer/Deployment.md`, `deployment-render.md`, `deployment-pi.md` — deployment guides; Render is the live target.
- `Developer/Chat-Moderation.md` — censorship and moderation design.
- `Developer/TODO.md`, `Developer/rollout.md` — outstanding work and rollout plan.

Both directories are capitalised (`Docs/`, `Developer/`); some in-code comments still spell the first one `docs/`, which only resolves on a case-insensitive filesystem.

### Roles & moderation
Accounts hold one of three hierarchical roles: `player`, `moderator`, `admin`. Moderators are regular players who can delete messages in the global and in-game chats (never private group chats) and ban or mute users, via controls shown inline on the player site. Admins get everything a moderator has plus `admin.{domain}`. Acting on another user requires strictly outranking them, enforced in `#services/moderation_service`; every action is written to a `moderation_actions` audit trail. Bootstrap the first admin with `node ace user:role <username> admin`. See `Docs/features.md` (Roles & Moderation).

Chat censorship and username filtering read their wordlists from `apps/backend/resources/wordlist.json`, which is **gitignored on purpose** so the words stay out of the repository. Copy `resources/wordlist.example.json` to `resources/wordlist.json` on a fresh checkout or the server refuses to boot; `apps/backend/CLAUDE.md` has the details.

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

Dev ports: backend **3333**, player site **3000**, admin site **3001**.

- `turbo test` depends on `build` — the schema/registry generation must run before tests.
- Run a subset of tests with Japa filters, e.g. `node ace test --files="user"`, `--groups="..."`, `--tags="..."`, or a single suite with `node ace test unit`. Suites are `unit` (`tests/unit/**/*.spec.ts`, 2s timeout) and `functional` (`tests/functional/**/*.spec.ts`, 30s).
- Ace is the CLI for everything else: `node ace list` to see commands, `node ace make:controller`, `node ace migration:run`, etc. `node ace list:routes` is the quickest confirmation that a new route registered.
- Project commands in `apps/backend/commands/`: `node ace user:role <username|email> <player|moderator|admin>` (the only way to create the first admin) and `node ace accounts:purge` (hard-deletes accounts past their soft-delete grace period).
- Development data is SQLite at `apps/backend/tmp/db.sqlite3` — gitignored, so it is the only copy of it anywhere; tests use a separate `tmp/test.sqlite3`. Production is Postgres.
- `database/schema.ts` **fails `npm run lint`**. It is generated, marked DO NOT EDIT, and rewritten on every `migration:run`, so the errors come straight back — not something you broke.

Frontend scripts run inside `apps/frontend` (also driven by Turbo from root): `npm run dev` (Vite on port 3000), `npm run build`, `npm test` (Vitest), `npm run lint` (ESLint), `npm run format` (Prettier + eslint --fix). Route generation: `npm run generate-routes` (`tsr generate`).

Admin scripts run inside `apps/admin`: `npm run dev` (Vite on port 3001), `npm run build` (output in `dist/`), `npm run lint`, `npm run typecheck`. It has no tests or route generation.

## Architecture

Backend architecture (generated schema and models, Tuyau client generation, response shape, auth guards, import aliases) is documented in `apps/backend/CLAUDE.md`; the frontend stack and conventions in `apps/frontend/CLAUDE.md`; the admin app in `apps/admin/CLAUDE.md`. Each loads when working under that app.

### The game runs in three layers
Everything under `apps/backend/app/services/game/`. The split is load-bearing — keep rules out of the socket layer and I/O out of the rules:
- **`engine.ts`** — the **pure** rule set: `GameState`, `GameRules`/`CLASSIC_RULES`, and the move functions (`createGame`, `drawFromDeck`, `takeDiscard`, `layMelds`, `addGoer`, `takeJoker`, `discard`, `decideBuyIn`, `startNextRound`, `removePlayer`). Illegal moves throw `GameError`. Randomness is an injected `Rng` (`cards.ts`), so tests seed it and get deterministic deals. No sockets, no database, no timers. Meld validation sits beside it in `melds.ts`.
- **`match_service.ts`** — live orchestration: the public matchmaking queue, private group lobbies, practice matches against bots (`bot.ts`, `bot_users.ts`), **per-player redacted views**, move and rejoin timers, disconnect pausing. It reaches the outside world only through an injected emitter (`configureMatchService`), so it is testable without I/O too.
- **`socket_bindings.ts`** — parses untrusted socket payloads, checks group authorization, and routes `match:queue`, `match:practice`, `lobby:*`, `game:view` and `game:action` into the match service. It enforces no rules of its own.

**Live match state lives in process memory** — plain `Map`s in `match_service.ts`, not the database. Only finished matches are persisted, by `#services/match_history_service` (wired to the match-finished callback in `providers/socket_provider.ts`), plus scheduled lobbies via the `scheduled_games` table so a pending schedule survives a restart. Two consequences to keep in mind before touching deployment or scaling: restarting the backend destroys every in-flight game, lobby and queue entry, and the app **cannot run more than one instance** without a Socket.IO adapter — `render.yaml` pins `numInstances: 1` for exactly that reason.

### Realtime
Real-time gameplay and chat run over **Socket.IO**, attached to the AdonisJS HTTP server. Chosen for its rooms/namespaces (one room per match / group chat / global chat), built-in auto-reconnect (pairs with the 5-minute rejoin timer), and ack callbacks for server-validated moves. The socket handshake carries the API token, and a socket only joins rooms it's authorized for — a player never receives opponents' hidden state. See `Docs/Architecture.md`.

Entry points: `providers/socket_provider.ts` attaches the server once the HTTP server is ready (and owns the hourly chat-retention sweep); `#services/socket_service` authenticates the handshake and owns the chat and presence rooms (`chatRoom()`, `userRoom()`); game handlers come from `#services/game/socket_bindings`. Every player also gets a `user:{id}` room so a match broadcast can target them with their own redacted view. On the frontend, `src/lib/socket.ts` is a singleton whose auth callback re-reads the stored token on every reconnect.

### Rate limiting
Every route group carries a throttle defined in `start/limiter.ts`: `authThrottle` (per-IP, on signup/login/email verification) and `apiThrottle` (keyed by user id, falling back to IP via silent auth). The failed-login lockout and the per-account group-creation cap are consumed inside their controllers instead, so only a request that gets that far spends a slot. Limits are exported constants because the limiter manager caches instances by option values and tests need to reach the same ones.

### Email
Outgoing mail goes through `@adonisjs/mail` with **Resend** as the only configured mailer (`apps/backend/config/mail.ts`). One mailer is defined on purpose: a fallback transport that silently accepts messages in production is how "the verification email never arrived" becomes an invisible failure. The single transactional message today is the signup verification link.

Without `RESEND_API_KEY`, `#services/email_verification_service` logs the verification link instead of sending it, and **throws in production** rather than leaving an account unusable. So development and tests never post to a real provider, and a misconfigured production deploy fails loudly. `MAIL_FROM_ADDRESS` must sit on a domain verified with Resend (SPF + DKIM) or the provider rejects the message. Verification links point at `FRONTEND_URL` (the player site), not the API, and fall back to `APP_URL` when unset, which is only correct for a same-origin deployment.

### Deployment
The live target is **Render**, described by `render.yaml` (blueprint) and `render-build.sh`. It defines the backend web service and its Postgres only — the two SPAs deploy separately, for the reasons in `Developer/deployment-render.md` §8. It tracks the **`production` branch**, not `main`. The build script places the gitignored wordlist from a Render secret file and fails loudly when it is absent, since the server would otherwise only discover it at boot.

## Coding conventions

From `Docs/Coding-Conventions.md`:
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes and **React component files** (e.g. `Header.tsx`). Exception: shadcn/ui primitives keep the lowercase filenames the CLI generates (e.g. `button.tsx`). Backend files use `snake_case`. Prefer longer, descriptive names when they materially improve readability.
- **Imports:** always use the subpath aliases (`#controllers/*`, `#models/*`, …), never relative paths.
- **TypeScript:** no `any` (only where genuinely tolerated), avoid non-null assertions (`!`), and give exported functions explicit return types.
- **React:** function components only, with a separate `interface` for props; keep state flat; build with reusable components.
- **Comments:** doc-style comments on functions; inline explanatory comments 3 lines or less. Write descriptive error messages with proper error handling.
- **Styling:** TailwindCSS, using Tailwind variables for repeated colours.
