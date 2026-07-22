# CLAUDE.md (apps/backend)

Backend-specific guidance for the AdonisJS API. Repo-wide context, commands, and coding conventions are in the root `CLAUDE.md`.

## Generated schema, hand-written models
`app/models/*.ts` do **not** declare columns. Instead, `database/schema.ts` is **auto-generated from migrations** (marked DO NOT EDIT) and exports one `*Schema` base class per table with all `@column` definitions. Models compose from these:

```ts
export default class User extends compose(UserSchema, withAuthFinder(hash)) { ... }
```

**After changing a migration, run `node ace migration:run` to regenerate `database/schema.ts`.** Add validation constraints tied to the schema in `database/schema_rules.ts`. To change a column, edit the migration — not the generated schema.

## Init hooks generate the client (`adonisrc.ts`)
Two init hooks run on boot/build:
- `indexEntities({ transformers: { enabled: true } })` — indexes controllers/transformers into `#generated/*` (`.adonisjs/server/`).
- `generateRegistry()` (Tuyau) — emits the type-safe client under `.adonisjs/client/`, exported from `package.json` as `@KalookiOnline/backend/data` and `/registry` for frontend apps to consume.

Routes reference controllers through the generated registry, not direct imports:
```ts
import { controllers } from '#generated/controllers'
router.post('signup', [controllers.NewAccount, 'store'])
```

## Response shape: `ctx.serialize()` + transformers
`providers/api_provider.ts` augments `HttpContext` with a `serialize()` method (and `serialize.withoutWrapping()`) backed by a custom `ApiSerializer`. **All responses are wrapped under a `data` key** and paginated Lucid results get standardized metadata. Controllers shape model output through `BaseTransformer` subclasses in `app/transformers/` before serializing:
```ts
return serialize({ user: UserTransformer.transform(user), token: ... })
```

**Gotcha: use `type` aliases, never `interface`, for anything a controller serializes.** The serializer's return type only wraps the payload in `data` when the value satisfies its JSON constraint, and an `interface` has no implicit index signature, so it silently fails that check — `serialize()` then types as the bare payload and the generated client loses the `data` wrapper (the runtime response still has it, so this shows up as a type error in the consuming app, not a test failure). Declare shapes returned through `serialize()` as `export type X = { ... }`.

## Auth: two guards
`config/auth.ts` defines `api` (opaque access tokens via `DbAccessTokensProvider`, the **default** guard, stateless) and `web` (session). Signup/login mint an access token (`User.accessTokens.create`). Protected routes use the named `auth()` middleware; `silent_auth_middleware` runs globally to populate the user when a token is present without forcing auth.

## Import aliases
Subpath imports (`#controllers/*`, `#models/*`, `#validators/*`, `#transformers/*`, `#generated/*`, `#database/*`, etc.) are defined in `apps/backend/package.json` `imports`. Use these rather than relative paths.
