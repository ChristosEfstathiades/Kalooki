# Build prompt — Kalooki Online

> Hand this to a Fable 5 agent (`claude-fable-5`) working in the repo root. It assumes the agent can read files, run the toolchain, and commit.

---

You are building **Kalooki Online**, a website for the multiplayer card game Kalooki. The project's intent, architecture, and conventions are already written down — your job is to implement them, not to redesign them.

## Read first (these are the source of truth)

Before writing any code, read and internalise:

- `CLAUDE.md` — repo overview, monorepo layout, backend + frontend architecture, commands, and coding conventions. **This overrides your defaults.**
- `docs/Overview.md` — what the product is.
- `docs/features.md` — accounts, friends, private groups, group chat, global chat, match history, game modes. This is the functional spec.
- `docs/Kalooki.md` — full game rules, scoring, timers, disconnect/rejoin handling, and custom-rule options.
- `docs/Architecture.md` — frontend/backend split, auth, realtime (Socket.IO), DB, file storage.
- `docs/Coding-Conventions.md` — naming, imports, TypeScript strictness, React rules.
- `docs/Frontend-design.md` — UI/UX direction, theme/colours, and per-page layout.

If two documents disagree, stop and flag it rather than guessing.

## Decisions already made — do not relitigate

- **Monorepo:** Turborepo + npm workspaces. `apps/backend` (AdonisJS 7 API, Lucid, token auth, Tuyau client) and `apps/frontend` (TanStack Start + React 19, shadcn/ui, Tailwind v4). Both are already scaffolded.
- **Realtime:** Socket.IO, attached to the AdonisJS HTTP server. Token in the handshake; a socket only joins rooms it is authorized for.
- **Auth:** API token guard. Signup = email + unique username + password (≥8 chars, ≥1 symbol, ≥1 capital) + confirmation + optional avatar.
- **Email verification:** production-only; in development accounts activate immediately. **Email sending is deferred** — do not build a mail transport; gate verification behind an env/environment check and leave a clear TODO.
- **Avatars:** stored on local disk, served from the backend.
- **DB:** SQLite in development, Postgres in production.
- **React component files:** PascalCase (e.g. `Header.tsx`); shadcn/ui primitives keep their lowercase CLI-generated names.

## How to work

1. **Wire the frontend → backend client first.** The frontend currently depends only on `@tuyau/core` and has no workspace dependency on the backend package (`@KalookiOnline/backend`). Set that up and confirm an end-to-end typed call works before building features on top of it.
2. **Build in vertical slices**, in this order, so each slice is demoable:
   1. Auth: signup, signin (with "remember me"), the token flow, and route protection. Skip email verification in dev.
   2. Core pages + shell: welcome page, header, footer, the content pages (how to play/rules, tips & tricks, contact/support, privacy policy), and the logged-in play page layout.
   3. Social: friends (exact-username requests, accept/decline/cancel/remove) and private groups (invites, ownership, membership rules).
   4. Chat: global chatroom and per-group chat over Socket.IO, with the rate limits, retention, and censorship rules in `docs/features.md`.
   5. Gameplay: the Kalooki engine (dealing, draw/discard, coming down, go-ers, jokers, calling up, scoring, buy-ins) and the real-time table, including the move timer and disconnect/rejoin logic from `docs/Kalooki.md`. Public matches use the fixed classic ruleset; private matches support the custom rules.
   6. Match history.
3. **For each slice:** write the migration(s) first (the backend generates `database/schema.ts` from migrations — never hand-edit it), then models/validators/controllers/transformers, then routes, then the frontend. Run `node ace migration:run` after migration changes.
4. **Verify before moving on.** Run lint, typecheck, and tests for the workspaces you touched, and exercise the actual flow — don't rely on tests alone.

## Non-negotiable quality bars

- **Follow `CLAUDE.md` and `docs/Coding-Conventions.md` exactly** — subpath import aliases (never relative), no `any`, no non-null assertions, explicit return types on exported functions, function components with separate props interfaces, flat React state, doc-style comments on functions.
- **Follow `docs/Frontend-design.md`:** dark theme (`#141616` main background), blue/purple low-contrast buttons, white high-contrast text, mobile responsive, semantic HTML, pointer cursor on buttons, Tailwind with variables for repeated colours. **No AI-slop design** — no gratuitous gradients, animations, or emoji. Prioritise getting a user from landing to a game in as few clicks as possible.
- **Authorization is a hard requirement:** only authenticated users play, and a player must never be able to see another player's hidden state (their hand). Enforce this on both the HTTP and Socket.IO layers, not just the UI.
- **All API responses go through `ctx.serialize()` + transformers** and are wrapped under `data`, per the backend architecture.

## When you're unsure

The docs are detailed but not exhaustive. Where a doc is silent on an implementation detail, pick the option most consistent with the existing code and conventions, note the choice in your summary, and keep going. Where a doc is *contradictory* or a choice would be expensive to reverse (schema shape, auth model, realtime protocol), stop and ask.

Start by reading the docs and confirming the frontend→backend client wiring, then propose your first slice.
