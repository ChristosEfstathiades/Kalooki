import { useEffect, useRef } from 'react'

/** Title shown in the tab while an unseen turn is waiting. */
const ALERT_TITLE = 'Your turn · Kalooki'

/**
 * Flags the player's turn in the tab title while the table is out of
 * sight. A turn can be minutes away in a five-player match, so a player
 * who tabbed away has no other way of knowing their go arrived.
 *
 * The title is restored as soon as the tab is looked at again, when the
 * turn passes on, and on unmount.
 */
export function useTurnTitleAlert(isMyTurn: boolean): void {
  // Captured once so repeated alerts cannot save the alert as the
  // "original" title and leave it stuck there
  const originalTitleRef = useRef<string | null>(null)

  useEffect(() => {
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title
    }
    const originalTitle = originalTitleRef.current

    const syncTitle = (): void => {
      document.title = isMyTurn && document.hidden ? ALERT_TITLE : originalTitle
    }

    syncTitle()
    document.addEventListener('visibilitychange', syncTitle)
    return () => {
      document.removeEventListener('visibilitychange', syncTitle)
      document.title = originalTitle
    }
  }, [isMyTurn])
}
