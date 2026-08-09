import { useEffect, useState } from 'react'

/**
 * A hash-based router in place of a routing library.
 *
 * The admin app grew past one view, so its sections need to be
 * deep-linkable and survive a refresh — but it is a single-origin
 * internal tool with no SSR, no loaders and no nested layouts, so a
 * router package would be all cost. Reading `location.hash` gives back
 * shareable URLs (admin.{domain}/#/reports) in a few lines.
 */

export const ADMIN_SECTIONS = [
  'overview',
  'reports',
  'users',
  'chat',
  'audit',
  'news',
  'settings',
  'stats',
] as const

export type AdminSection = (typeof ADMIN_SECTIONS)[number]

const DEFAULT_SECTION: AdminSection = 'overview'

/**
 * Reads the section out of the current hash, falling back to the
 * overview for an empty or unrecognised one.
 */
function sectionFromHash(): AdminSection {
  const value = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return (ADMIN_SECTIONS as readonly string[]).includes(value)
    ? (value as AdminSection)
    : DEFAULT_SECTION
}

/**
 * The section currently shown, kept in step with the address bar so the
 * browser's back button works.
 */
export function useAdminSection(): AdminSection {
  const [section, setSection] = useState<AdminSection>(sectionFromHash)

  useEffect(() => {
    const onHashChange = () => setSection(sectionFromHash())
    window.addEventListener('hashchange', onHashChange)
    // A hash set before this mounted (e.g. a pasted deep link)
    onHashChange()
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return section
}

/**
 * Navigates to a section, pushing a history entry so back returns to
 * the previous one.
 */
export function navigateToSection(section: AdminSection): void {
  window.location.hash = `#/${section}`
}

/**
 * The href for a section, so navigation links are real anchors and
 * behave like links (middle click, copy address, and so on).
 */
export function sectionHref(section: AdminSection): string {
  return `#/${section}`
}
