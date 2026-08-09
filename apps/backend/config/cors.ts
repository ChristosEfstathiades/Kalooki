import { defineConfig } from '@adonisjs/cors'
import { allowedOrigins } from '#services/allowed_origins'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  /**
   * Enable or disable CORS handling globally.
   */
  enabled: true,

  /**
   * In development, allow every origin to simplify local front/backend
   * setup. In production, the explicit `CORS_ORIGIN` allowlist shared
   * with the Socket.IO server (AUDIT.md S6).
   *
   * Resolved per request rather than at config load so the allowlist is
   * read after the logger is available, and so the same function backs
   * both layers.
   */
  origin: () => allowedOrigins(),

  /**
   * HTTP methods accepted for cross-origin requests.
   */
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Reflect request headers by default. Use a string array to restrict
   * allowed headers.
   */
  headers: true,

  /**
   * Response headers exposed to the browser.
   */
  exposeHeaders: [],

  /**
   * Allow cookies/authorization headers on cross-origin requests.
   */
  credentials: true,

  /**
   * Cache CORS preflight response for N seconds.
   */
  maxAge: 90,
})

export default corsConfig
