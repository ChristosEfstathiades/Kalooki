# Overview

The frontend and backend are seperated into two folders in the apps folders
The frontend communicates to the backend via api call.
They are seperated so future mobile apps or desktop applications can use the same backend api.

A third app, `apps/admin`, is the admin-only site served from `admin.{domain}`. It is a separate build for the same reason the frontend is separate from the backend: no admin code ever ships in the bundle players download, and the two sites are separate origins with separate sessions. It consumes the same API and the same generated Tuyau client.

## Backend - app/backend

Built using adonisjs. Use adonisjs documentation to understand folder layout ([https://docs.adonisjs.com/](https://docs.adonisjs.com/)).

### Authentication

- use API tokens
- Clean API structure with versioning
- CORS, Shield middleware, and secure authentication
- To create an account users provide an email address, a unique username, a password, and a matching password confirmation. Avatars are DiceBear "bottts" robots generated from the username, so there is no photo upload. In production the account stays inactive until the user verifies their email via a confirmation link; in development verification is skipped and accounts are active immediately. Full signup and password rules are defined in features.md.
- Rate limiting via `@adonisjs/limiter` (in-memory store, matching the single-process deployment): login/signup are throttled at 5 requests/min per IP, authenticated endpoints share a 60 requests/min per-user ceiling, and 10 failed logins for the same account+IP within 15 minutes lock login out for 15 minutes (a successful login resets the counter). Throttle definitions live in `apps/backend/start/limiter.ts`.

### Authorization

- Make sure only users who are logged in can play games
- only users in a game should be able to affect the game and should not have access to other players data like the cards they hold
- Accounts carry a hierarchical role — `player`, `moderator`, `admin` — stored on `users.role`. Routes are gated with the named `role` middleware (`middleware.role('moderator')`, `middleware.role('admin')`), which runs after `middleware.auth()`. Moderation endpoints live under `/api/v1/moderation`, admin-only endpoints under `/api/v1/admin`.
- Role predicates (`hasAtLeastRole`, `canModerate`, `isBanned`, `isMuted`) live in `#services/role_service`, which is dependency-free so both the chat service and the moderation service can use it without an import cycle. The actions themselves, and the audit trail they write, live in `#services/moderation_service`.
- Whether one user may act on another is decided in the service layer, not the controllers, so the same rule applies however an action is reached: the actor must outrank the target, and can never target themselves.
- Bans are enforced in three places: login refuses them, the auth middleware rejects a token that outlives the ban, and the socket handshake refuses a connection. Banning also revokes the user's tokens and disconnects their live sockets.

### Real time events

- Real-time gameplay and chat run over **Socket.IO**, attached to the AdonisJS HTTP server.
- Rationale: Kalooki is turn-based, so raw latency matters less than reliability and connection management. Socket.IO gives us rooms/namespaces (one room per match, per group chat, and the global chat), built-in auto-reconnect (which pairs directly with the 5-minute rejoin timer), and acknowledgement callbacks so a client move can be validated server-side and confirmed/rejected in one round trip. Native `ws` would mean hand-rolling rooms, heartbeats, and reconnection; SSE-based options (e.g. `@adonisjs/transmit`) are server→client only and can't carry player moves.
- Auth: the socket handshake carries the API token; sockets are authenticated the same way as HTTP requests, and a socket only joins rooms it's authorized for (enforcing the authorization rules above — a player never receives other players' hidden state).

### File storage

- Avatars are DiceBear "bottts" robots generated on the client from the username (`@dicebear/core` + `@dicebear/collection`), so nothing is uploaded or stored. If user-supplied images are reintroduced later, they can live on local disk first and move to an object store (e.g. S3) without changing the API contract.

### DB

- Production - Postgres
- Development - SQLite

## Frontend

uses Tanstack start and reactjs.
uses API Guard (Token-Based)

Moderators use the player site like anyone else; their extra controls appear inline in chat rather than on a separate page (see features.md, Roles & Moderation).

## Admin app - apps/admin

A plain Vite + React SPA (no router while it is a single view; add one when the tooling grows past one page). Dev server on port 3001, deployed to `admin.{domain}`.

- It talks to the same backend over the same Tuyau client, and stores its token under its own key (`kalooki.admin.accessToken`) so the two sessions never collide in local development, where both apps run on `localhost`.
- Sign in goes through the normal `/api/v1/auth/login` endpoint, but the app refuses any account whose role is not `admin` and throws the token away. That is a convenience, not the security boundary: the boundary is `middleware.role('admin')` on the `/api/v1/admin` routes.
- Its styling is deliberately colder and denser than the player site's card-room palette, so it is obvious at a glance which app you are looking at. Dark only — it is an internal tool, and the page is marked `noindex, nofollow`.
