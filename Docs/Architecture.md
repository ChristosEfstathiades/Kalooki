# Overview

The frontend and backend are seperated into two folders in the apps folders
The frontend communicates to the backend via api call.
They are seperated so future mobile apps or desktop applications can use the same backend api.

## Backend - app/backend

Built using adonisjs. Use adonisjs documentation to understand folder layout ([https://docs.adonisjs.com/](https://docs.adonisjs.com/)).

### Authentication

- use API tokens
- Clean API structure with versioning
- CORS, Shield middleware, and secure authentication
- To create an account users provide an email address, a unique username, a password, and a matching password confirmation. Avatars are DiceBear "bottts" robots generated from the username, so there is no photo upload. In production the account stays inactive until the user verifies their email via a confirmation link; in development verification is skipped and accounts are active immediately. Full signup and password rules are defined in features.md.

### Authorization

- Make sure only users who are logged in can play games
- only users in a game should be able to affect the game and should not have access to other players data like the cards they hold

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
