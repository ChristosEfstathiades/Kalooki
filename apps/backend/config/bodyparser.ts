import { defineConfig } from '@adonisjs/core/bodyparser'

const bodyParserConfig = defineConfig({
  /**
   * Parse request bodies for these HTTP methods.
   * Keep this aligned with methods that receive payloads in your routes.
   */
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Config for the "application/x-www-form-urlencoded"
   * content-type parser.
   */
  form: {
    /**
     * Normalize empty string values to null.
     */
    convertEmptyStringsToNull: true,

    /**
     * Content types handled by the form parser.
     */
    types: ['application/x-www-form-urlencoded'],
  },

  /**
   * Config for the JSON parser.
   */
  json: {
    /**
     * Normalize empty string values to null.
     */
    convertEmptyStringsToNull: true,

    /**
     * Content types handled by the JSON parser.
     */
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
  },

  /**
   * Config for the "multipart/form-data" content-type parser.
   *
   * Disabled: this API has no upload endpoints at all (avatars are
   * DiceBear robots generated in the browser, and docs/features.md rules
   * out photo upload), so nothing here should ever receive a file.
   *
   * Leaving the starter kit's defaults in place was a liability rather
   * than dead config (AUDIT.md S9). The body parser runs in the global
   * router stack, ahead of the per-route auth and throttle middleware,
   * so with `autoProcess` on, any unauthenticated request to any route
   * had its 20 MB of parts streamed to the system tmp directory before
   * anything could reject it, and `streamFile` only cleans up on error,
   * so the file stayed there after the response.
   *
   * An empty `types` list means the parser never claims a request (see
   * the `types.length` guard in its `isType` check), so a multipart body
   * is now ignored and the request fails validation with an empty body.
   * If an upload endpoint is ever added, restore the content type and
   * name that one route in `processManually` rather than turning
   * `autoProcess` back on globally.
   */
  multipart: {
    autoProcess: false,

    /**
     * Normalize empty string values to null.
     */
    convertEmptyStringsToNull: true,

    /**
     * Routes where multipart processing is handled manually.
     */
    processManually: [],

    /**
     * Maximum accepted payload size for multipart requests.
     */
    limit: '20mb',

    types: [],
  },
})

export default bodyParserConfig
