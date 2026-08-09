import { createTuyau } from '@tuyau/core/client'
import { registry } from '@KalookiOnline/backend/registry'
import { getStoredToken } from '#/lib/auth-token'

/**
 * Base URL of the backend API, shared with the player site. Set
 * VITE_API_URL at build time (Docs/Deployment.md); defaults to the
 * local AdonisJS dev server.
 */
function resolveBaseUrl(): string {
  const configured: unknown = import.meta.env.VITE_API_URL
  return typeof configured === 'string' && configured !== ''
    ? configured
    : 'http://localhost:3333'
}

export const apiBaseUrl: string = resolveBaseUrl()

/**
 * Type-safe Tuyau client. Attaches the stored admin token as a bearer
 * header on every request when present.
 */
export const api = createTuyau({
  registry,
  baseUrl: apiBaseUrl,
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
