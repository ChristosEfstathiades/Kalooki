/**
 * The admin app stores its token under its own key. admin.{domain} is a
 * separate origin from the player site, so the two sessions are already
 * isolated; the distinct key keeps that true in local development,
 * where both apps run on localhost.
 */
const TOKEN_STORAGE_KEY = 'kalooki.admin.accessToken'

/**
 * Reads the stored admin access token, if any.
 */
export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

/**
 * Stores the access token after a successful admin signin.
 */
export function storeToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

/**
 * Removes the stored token, e.g. on sign-out or when the backend
 * rejects it.
 */
export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}
