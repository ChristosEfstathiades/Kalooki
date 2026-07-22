/**
 * Security response headers for the Nitro-served frontend (AUDIT.md S5).
 *
 * The access token lives in web storage, so any script that runs on the
 * page can read it. Nothing renders untrusted HTML today, but a single
 * future slip (a compromised dependency, a rich-text feature) would turn
 * into token theft. A Content-Security-Policy is the defence in depth:
 * it pins where scripts may load from and, more importantly, where the
 * page may send data, so a stolen token has nowhere to go.
 */

/**
 * Parses the API base URL the app was built against.
 *
 * @throws Error when VITE_API_URL is not a URL, rather than emitting a
 *   policy that would block every call to the backend.
 */
function apiUrl(apiBaseUrl: string): URL {
  try {
    return new URL(apiBaseUrl)
  } catch {
    throw new Error(
      `VITE_API_URL is not a valid URL (${apiBaseUrl}); the Content-Security-Policy needs it to allow API and WebSocket calls.`,
    )
  }
}

/**
 * Origins the page is allowed to talk to: the API and the Socket.IO
 * WebSocket to the same host, which `connect-src` treats as a separate
 * ws:/wss: origin.
 */
function apiConnectOrigins(url: URL): string[] {
  const socketOrigin = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`
  return [url.origin, socketOrigin]
}

/**
 * Builds the Content-Security-Policy for the built app.
 *
 * `'unsafe-inline'` is unavoidable in `script-src`: the theme init script
 * and TanStack Start's hydration payload are inline, and their contents
 * vary per build and per route, so neither hashes nor a static nonce
 * work. It stays worthwhile anyway, because the directives that actually
 * limit the damage of an injected script are `connect-src` (no
 * exfiltration to an attacker's host), `object-src`, `base-uri` and
 * `form-action`. Inline `style` attributes are used throughout the UI,
 * so `style-src` needs it too.
 */
export function contentSecurityPolicy(apiBaseUrl: string): string {
  const url = apiUrl(apiBaseUrl)
  const connect = ["'self'", ...apiConnectOrigins(url)].join(' ')

  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // Avatars are DiceBear robots generated in the browser as data URIs
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ]

  // Only when the API itself is served over TLS: on a plain-http API
  // (a LAN or staging build) this directive would rewrite every API and
  // WebSocket call to https and break the app.
  if (url.protocol === 'https:') {
    directives.push('upgrade-insecure-requests')
  }

  return directives.join('; ')
}

/**
 * The full header set applied to every response the frontend serves.
 */
export function securityHeaders(apiBaseUrl: string): Record<string, string> {
  return {
    'content-security-policy': contentSecurityPolicy(apiBaseUrl),
    // Belt and braces with frame-ancestors, for anything that predates it
    'x-frame-options': 'DENY',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy':
      'camera=(), microphone=(), geolocation=(), payment=()',
  }
}
