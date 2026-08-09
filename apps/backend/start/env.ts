/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Chat: comma-separated hosts a chat link may point at (our own site).
  // Defaults to the APP_URL host when unset — see #services/link_filter
  CHAT_LINK_ALLOWED_HOSTS: Env.schema.string.optional(),

  // CORS: comma-separated origins allowed to call this API from a
  // browser, e.g. https://kalooki.example,https://admin.kalooki.example
  // Read in production only; see #services/allowed_origins
  CORS_ORIGIN: Env.schema.string.optional(),

  // Where the player-facing site lives. Verification links in outgoing
  // email point here, not at the API. Defaults to APP_URL when unset,
  // which is only correct for a same-origin deployment.
  FRONTEND_URL: Env.schema.string.optional({ format: 'url', tld: false }),

  // Mail (production email verification). Without RESEND_API_KEY the
  // app falls back to logging messages instead of sending them, so
  // development and tests never post to a real provider.
  RESEND_API_KEY: Env.schema.string.optional(),
  MAIL_FROM_ADDRESS: Env.schema.string.optional(),
  MAIL_FROM_NAME: Env.schema.string.optional(),

  // Database: SQLite by default; set DB_CONNECTION=pg (plus the PG_*
  // variables) in production
  DB_CONNECTION: Env.schema.enum.optional(['sqlite', 'pg'] as const),
  PG_HOST: Env.schema.string.optional({ format: 'host' }),
  PG_PORT: Env.schema.number.optional(),
  PG_USER: Env.schema.string.optional(),
  PG_PASSWORD: Env.schema.string.optional(),
  PG_DB_NAME: Env.schema.string.optional(),
})
