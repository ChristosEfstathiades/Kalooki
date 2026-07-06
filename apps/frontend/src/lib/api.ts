import { createTuyau } from '@tuyau/core/client'
import { registry } from '@KalookiOnline/backend/registry'
import { getStoredToken } from '#/lib/auth-token'

/**
 * Base URL of the backend API. Configurable per environment via
 * VITE_API_URL; defaults to the local AdonisJS dev server.
 */
function resolveBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_URL
  return typeof configured === 'string' && configured !== '' ? configured : 'http://localhost:3333'
}

/**
 * Type-safe Tuyau client for the backend API. Attaches the stored
 * access token as a bearer header on every request when present.
 */
export const api = createTuyau({
  registry,
  baseUrl: resolveBaseUrl(),
  hooks: {
    beforeRequest: [
      (request): void => {
        const token = getStoredToken()
        if (token) {
          request.headers.set('Authorization', `Bearer ${token}`)
        }
      },
    ],
  },
})
