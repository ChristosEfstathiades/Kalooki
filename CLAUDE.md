# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repo is building **Kalooki Online** — a website for playing the multiplayer card game Kalooki (aka Kaluki), a Rummy-family game popular in the UK, Jamaica, and Cyprus. Users need an account to play, and can play public matches against strangers (fixed classic ruleset) or private matches with friends (customisable rules). Games run in real time over websockets. The site also has content pages (how to play/rules, tips and tricks, contact/support, privacy policy), friends, private groups with group chat, a global chatroom, and match history.

The codebase is a Turborepo monorepo (npm workspaces) with three apps:
- **`apps/backend`** — an AdonisJS 7 (next-major/experimental) HTTP API using Lucid ORM, token-based auth, and Tuyau for generating a type-safe client. Started from an AdonisJS API starter kit.
- **`apps/frontend`** — a **TanStack Start + React 19** app that consumes the backend via the generated Tuyau client. Kept separate so future mobile/desktop apps can reuse the same API.
- **`apps/admin`** — a plain Vite + React 19 SPA for `admin.{domain}`, the admin-only site. Separate from the frontend so no admin code ships in the player bundle.

### Product docs (source of truth)
Product and design intent live in `docs/` — consult and keep these in sync when working on features:
- `docs/Overview.md` — high-level product summary and how the docs fit together.
- `docs/features.md` — user accounts, friends, private groups, global chat, match history, game modes.
- `docs/Kalooki.md` — full game rules, scoring, timers/disconnect handling, and custom-rule options for private games.
- `docs/Architecture.md` — frontend/backend split, auth, realtime, DB.
- `docs/Coding-Conventions.md` — coding conventions (summarised below).
- `docs/Frontend-design.md` — UI/UX direction, theme/colours, and per-page layout.

### Roles & moderation
Accounts hold one of three hierarchical roles: `player`, `moderator`, `admin`. Moderators are regular players who can delete messages in the global and in-game chats (never private group chats) and ban or mute users, via controls shown inline on the player site. Admins get everything a moderator has plus `admin.{domain}`. Acting on another user requires strictly outranking them, enforced in `#services/moderation_service`; every action is written to a `moderation_actions` audit trail. Bootstrap the first admin with `node ace user:role <username> admin`. See `docs/features.md` (Roles & Moderation).

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

Frontend scripts run inside `apps/frontend` (also driven by Turbo from root): `npm run dev` (Vite on port 3000), `npm run build`, `npm test` (Vitest), `npm run lint` (ESLint), `npm run format` (Prettier + eslint --fix). Route generation: `npm run generate-routes` (`tsr generate`).

Admin scripts run inside `apps/admin`: `npm run dev` (Vite on port 3001), `npm run build` (output in `dist/`), `npm run lint`, `npm run typecheck`. It has no tests or route generation.

## Architecture

Backend architecture (generated schema and models, Tuyau client generation, response shape, auth guards, import aliases) is documented in `apps/backend/CLAUDE.md`; the frontend stack and conventions in `apps/frontend/CLAUDE.md`; the admin app in `apps/admin/CLAUDE.md`. Each loads when working under that app.

### Realtime
Real-time gameplay and chat run over **Socket.IO**, attached to the AdonisJS HTTP server. Chosen for its rooms/namespaces (one room per match / group chat / global chat), built-in auto-reconnect (pairs with the 5-minute rejoin timer), and ack callbacks for server-validated moves. The socket handshake carries the API token, and a socket only joins rooms it's authorized for — a player never receives opponents' hidden state. See `docs/Architecture.md`.

> Note: email sending (for production email verification) is intentionally deferred — verification is production-only and its transport is not yet wired.

## Coding conventions

From `docs/Coding-Conventions.md`:
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes and **React component files** (e.g. `Header.tsx`). Exception: shadcn/ui primitives keep the lowercase filenames the CLI generates (e.g. `button.tsx`). Backend files use `snake_case`. Prefer longer, descriptive names when they materially improve readability.
- **Imports:** always use the subpath aliases (`#controllers/*`, `#models/*`, …), never relative paths.
- **TypeScript:** no `any` (only where genuinely tolerated), avoid non-null assertions (`!`), and give exported functions explicit return types.
- **React:** function components only, with a separate `interface` for props; keep state flat; build with reusable components.
- **Comments:** doc-style comments on functions; inline explanatory comments 3 lines or less. Write descriptive error messages with proper error handling.
- **Styling:** TailwindCSS, using Tailwind variables for repeated colours.
