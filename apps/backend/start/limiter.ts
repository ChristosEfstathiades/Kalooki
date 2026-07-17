/*
|--------------------------------------------------------------------------
| Rate limiters
|--------------------------------------------------------------------------
|
| Named HTTP throttle middleware and the failed-login lockout limiter,
| applied to routes in start/routes.ts and AccessTokensController.
|
*/

import type { Limiter } from '@adonisjs/limiter'
import limiter from '@adonisjs/limiter/services/main'

/*
 * Limit values live in exported constants so tests can reach the same
 * cached limiter instances (the manager caches by option values).
 */
export const AUTH_RATE_LIMIT = { requests: 5, duration: '1 minute' } as const
export const API_RATE_LIMIT = { requests: 60, duration: '1 minute' } as const
export const FAILED_LOGIN_RATE_LIMIT = {
  requests: 10,
  duration: '15 mins',
  blockDuration: '15 mins',
} as const

/**
 * Strict per-IP throttle shared by the unauthenticated auth endpoints
 * (login and signup) to slow credential stuffing and mass account
 * creation. Login is additionally covered by the per-account
 * failed-attempt lockout below.
 */
export const authThrottle = limiter.define('auth', () => {
  return limiter
    .allowRequests(AUTH_RATE_LIMIT.requests)
    .every(AUTH_RATE_LIMIT.duration)
    .limitExceeded((error) => {
      error.setMessage('Too many attempts. Please wait a minute before trying again.')
    })
})

/**
 * Generous global ceiling for authenticated endpoints, keyed by user id
 * so a hostile account cannot spam row-creating endpoints (friend
 * requests, groups, reports). Falls back to the client IP when the
 * request carries no valid token (silent auth has already run).
 */
export const apiThrottle = limiter.define('api', (ctx) => {
  const throttleKey = ctx.auth.user ? `user_${ctx.auth.user.id}` : `ip_${ctx.request.ip()}`
  return limiter
    .allowRequests(API_RATE_LIMIT.requests)
    .every(API_RATE_LIMIT.duration)
    .usingKey(throttleKey)
    .limitExceeded((error) => {
      error.setMessage('Too many requests. Please slow down and try again shortly.')
    })
})

/**
 * Failed-login lockout: 10 failed attempts for the same account from
 * the same IP within 15 minutes block further attempts for 15 minutes.
 * A successful login resets the counter (see AccessTokensController).
 */
export function failedLoginAttemptsLimiter(): Limiter {
  return limiter.use(FAILED_LOGIN_RATE_LIMIT)
}
