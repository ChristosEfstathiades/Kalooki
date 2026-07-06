const TOKEN_STORAGE_KEY = 'kalooki.accessToken'

/**
 * Returns whichever web storage should hold the access token, or null
 * during SSR where no storage exists.
 */
function availableStorages(): Storage[] {
  if (typeof window === 'undefined') {
    return []
  }
  return [window.localStorage, window.sessionStorage]
}

/**
 * Reads the stored access token. Checks localStorage first ("remember
 * me" signins) and falls back to sessionStorage (per-tab signins).
 */
export function getStoredToken(): string | null {
  for (const storage of availableStorages()) {
    const token = storage.getItem(TOKEN_STORAGE_KEY)
    if (token) {
      return token
    }
  }
  return null
}

/**
 * Stores the access token after signin/signup. "Remember me" persists
 * the token across browser restarts via localStorage; otherwise it
 * lives in sessionStorage and dies with the tab.
 */
export function storeToken(token: string, rememberMe: boolean): void {
  clearStoredToken()
  if (typeof window === 'undefined') {
    return
  }
  const storage = rememberMe ? window.localStorage : window.sessionStorage
  storage.setItem(TOKEN_STORAGE_KEY, token)
}

/**
 * Removes the access token from every storage, e.g. on logout or when
 * the backend rejects the token as expired.
 */
export function clearStoredToken(): void {
  for (const storage of availableStorages()) {
    storage.removeItem(TOKEN_STORAGE_KEY)
  }
}
