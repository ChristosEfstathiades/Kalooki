const THEME_STORAGE_KEY = 'kalooki.theme'

export type Theme = 'dark' | 'light'

/**
 * Runs in <head> before first paint: the server always renders
 * <html class="dark"> (dark is the default), so all this has to do is
 * strip the class for users who chose light. Kept as a string because
 * it must execute before React loads.
 */
export const themeInitScript = `try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='light')document.documentElement.classList.remove('dark')}catch(e){}`

/**
 * The user's stored theme choice for this device. Dark is the default
 * (docs/Frontend-design.md); light is opt-in from the settings page.
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light'
      ? 'light'
      : 'dark'
  } catch {
    return 'dark'
  }
}

/**
 * Applies and persists a theme choice. The class is toggled directly
 * on <html> (outside React), which is why the root document renders
 * its className with suppressHydrationWarning.
 */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return
  }
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (private mode): the theme still applies for
    // this page view, it just will not persist.
  }
}
