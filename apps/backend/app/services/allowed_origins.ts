import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

/**
 * The single cross-origin allowlist, shared by the HTTP CORS config and
 * the Socket.IO server (AUDIT.md S2, S6).
 *
 * Both layers used to decide this independently: `config/cors.ts` denied
 * every origin in production while `socket_service.ts` reflected every
 * origin unconditionally, so the comment claiming they mirrored each
 * other was wrong in the worst direction. They now read from here, which
 * is the only way to stop them drifting again.
 */

/** Parsed once at boot; the value cannot change without a restart. */
let cached: string[] | null = null

/**
 * Normalises one configured entry to a bare origin.
 *
 * Accepts a full URL and reduces it to scheme + host + port, so a
 * trailing slash or a stray path in the env var does not silently
 * produce an entry that can never match the browser's Origin header.
 *
 * @returns the normalised origin, or null when the entry is unusable.
 */
function normaliseOrigin(entry: string): string | null {
  const trimmed = entry.trim()
  if (trimmed === '') {
    return null
  }

  try {
    return new URL(trimmed).origin
  } catch {
    logger.warn(
      `CORS_ORIGIN contains "${trimmed}", which is not a valid URL. Expected a full origin such as https://kalooki.example. Ignoring it.`
    )
    return null
  }
}

/**
 * The configured origins, in the order given.
 */
function parseConfiguredOrigins(): string[] {
  const configured = env.get('CORS_ORIGIN')
  if (!configured) {
    return []
  }

  const origins: string[] = []
  for (const entry of configured.split(',')) {
    const origin = normaliseOrigin(entry)
    // Deduplicated because Socket.IO and the CORS middleware both do
    // linear scans over this on every preflight.
    if (origin && !origins.includes(origin)) {
      origins.push(origin)
    }
  }

  return origins
}

/**
 * Origins permitted to make cross-origin browser requests.
 *
 * `true` means "reflect any origin" and is only ever returned outside
 * production, where the frontend, the admin app and the test runner all
 * sit on different localhost ports and pinning them down buys nothing.
 *
 * In production this is the explicit list from `CORS_ORIGIN`. An empty
 * list denies every cross-origin request, which is the correct answer
 * for a same-origin deployment (one hostname, API routed by path, as in
 * `Developer/deployment-pi.md`) and a misconfiguration for a deployment
 * that serves the frontend from its own hostname. The two are
 * indistinguishable from in here, so this warns loudly rather than
 * refusing to boot.
 */
export function allowedOrigins(): string[] | true {
  if (!app.inProduction) {
    return true
  }

  if (cached === null) {
    cached = parseConfiguredOrigins()

    if (cached.length === 0) {
      logger.warn(
        'CORS_ORIGIN is not set, so every cross-origin request will be refused. ' +
          'Set it to the frontend and admin origins (comma separated) unless the ' +
          'frontend is served from this same hostname.'
      )
    } else {
      logger.info(`CORS allowlist: ${cached.join(', ')}`)
    }
  }

  return cached
}
