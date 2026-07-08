# Kalooki Online

A website for playing the multiplayer card game Kalooki (also known as Kaluki), a Rummy-family game popular in the UK, Jamaica, and Cyprus. Users create an account to play public matches against strangers (fixed classic ruleset) or private matches with friends (customisable rules), in real time over websockets. The site also includes how-to-play/rules content, tips and tricks, contact/support, a privacy policy, friends, private groups with group chat, a global chatroom, and match history.

## AI Usage

This is one of the first projects I've done where almost all code is AI generated via claude code.

## Stack

This is a Turborepo monorepo (npm workspaces) with two apps:

- **`apps/backend`** — AdonisJS 7 (next-major/experimental) HTTP API using Lucid ORM, token-based auth, and Tuyau to generate a type-safe client for the frontend.
- **`apps/frontend`** — TanStack Start + React 19, consuming the backend via the generated Tuyau client. Kept separate from the backend so future mobile/desktop clients can reuse the same API.

Realtime gameplay and chat run over Socket.IO, attached to the AdonisJS HTTP server. Database is SQLite in development and Postgres in production.

## Requirements

- Node >= 24
- npm 11

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` runs both apps through Turbo. Backend and frontend can also be run individually from inside `apps/backend` and `apps/frontend`.

## Commands

Root scripts run through Turbo across all workspaces:

| Task | Command |
| --- | --- |
| Dev server (HMR) | `npm run dev` |
| Build | `npm run build` |
| Tests | `npm test` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Typecheck | `npm run typecheck` |

See `apps/backend/README.md` and `CLAUDE.md` for per-app commands and more detail (Ace CLI, Japa test filters, route generation, etc).

## Documentation

Product and design intent live in `Docs/`:

- `Docs/Overview.md` — high-level product summary and how the docs fit together.
- `Docs/features.md` — user accounts, friends, private groups, global chat, match history, game modes.
- `Docs/Kalooki.md` — full game rules, scoring, timers/disconnect handling, and custom-rule options for private games.
- `Docs/Architecture.md` — frontend/backend split, auth, realtime, database.
- `Docs/Coding-Conventions.md` — coding conventions.
- `Docs/Frontend-design.md` — UI/UX direction, theme/colours, and per-page layout.

`CLAUDE.md` has additional guidance for working in this codebase with Claude Code.


