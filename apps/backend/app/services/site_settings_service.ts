import { DateTime } from 'luxon'
import SiteSetting from '#models/site_setting'
import type User from '#models/user'

/**
 * Runtime settings an admin can change from admin.{domain} without a
 * deploy: the feature kill switches, maintenance mode, and the
 * site-wide announcement banner.
 *
 * Values live in the site_settings table as JSON text. Every read goes
 * through the short-lived cache below, because the maintenance check
 * runs on every API request and must not cost a query each time.
 */

/**
 * Operational switches. All default to "the site works normally".
 *
 * Declared as a type alias rather than an interface because these
 * cross `ctx.serialize()`, which only recognises types carrying an
 * implicit index signature (see apps/backend/CLAUDE.md).
 */
export type SiteFlags = {
  /** Blocks the whole API for anyone who is not an admin. */
  maintenanceMode: boolean
  /** Whether new accounts can be created. */
  signupsEnabled: boolean
  /** Whether players can join the public matchmaking queue. */
  publicMatchmakingEnabled: boolean
  /** Whether players can start a practice game against bots. */
  practiceGamesEnabled: boolean
}

/** How prominently the banner is styled on the player site. */
export const ANNOUNCEMENT_TONES = ['info', 'warning', 'critical'] as const

export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number]

/** The site-wide banner, or null when nothing is being announced. */
export type Announcement = {
  body: string
  tone: AnnouncementTone
  /** ISO timestamp the banner stops showing at; null means until cleared. */
  expiresAt: string | null
  postedAt: string
  postedByUsername: string | null
}

const FLAGS_KEY = 'flags'
const ANNOUNCEMENT_KEY = 'announcement'

const DEFAULT_FLAGS: SiteFlags = {
  maintenanceMode: false,
  signupsEnabled: true,
  publicMatchmakingEnabled: true,
  practiceGamesEnabled: true,
}

/**
 * How long a loaded value is reused before the table is read again.
 * Short enough that flipping a switch takes effect almost at once, long
 * enough that a busy site is not querying settings per request.
 */
const CACHE_TTL_MS = 5_000

interface CacheEntry {
  value: unknown
  loadedAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * Reads one setting's JSON value, falling back to the supplied default
 * when the row is missing or its JSON no longer parses.
 */
async function readSetting<TValue>(key: string, fallback: TValue): Promise<TValue> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.value as TValue
  }

  const row = await SiteSetting.findBy('key', key)
  let value = fallback
  if (row) {
    try {
      value = JSON.parse(row.value) as TValue
    } catch {
      // A malformed row must not take the site down: fall back instead.
      value = fallback
    }
  }

  cache.set(key, { value, loadedAt: Date.now() })
  return value
}

/**
 * Writes one setting and refreshes its cache entry immediately, so the
 * admin who made the change sees it on their next request.
 */
async function writeSetting(key: string, value: unknown, editor: User | null): Promise<void> {
  await SiteSetting.updateOrCreate(
    { key },
    { key, value: JSON.stringify(value), updatedBy: editor?.id ?? null }
  )
  cache.set(key, { value, loadedAt: Date.now() })
}

/**
 * Drops the cache so the next read hits the table. Used by tests, and
 * after a bulk change.
 */
export function resetSiteSettingsCache(): void {
  cache.clear()
}

/**
 * The current feature switches, merged over the defaults so a flag
 * added later is enabled until someone turns it off.
 */
export async function getSiteFlags(): Promise<SiteFlags> {
  const stored = await readSetting<Partial<SiteFlags>>(FLAGS_KEY, {})
  return { ...DEFAULT_FLAGS, ...stored }
}

/**
 * Applies a partial change to the feature switches and returns the
 * full resulting set.
 */
export async function updateSiteFlags(
  editor: User,
  changes: Partial<SiteFlags>
): Promise<SiteFlags> {
  const next: SiteFlags = { ...(await getSiteFlags()), ...changes }
  await writeSetting(FLAGS_KEY, next, editor)
  return next
}

/**
 * The active announcement banner, or null when there is none or the
 * one on record has expired. An expired banner is left in the table
 * rather than cleared, so it can be read back and reused.
 */
export async function getAnnouncement(): Promise<Announcement | null> {
  const stored = await readSetting<Announcement | null>(ANNOUNCEMENT_KEY, null)
  if (!stored) {
    return null
  }
  if (stored.expiresAt !== null && DateTime.fromISO(stored.expiresAt) <= DateTime.now()) {
    return null
  }
  return stored
}

/**
 * Raises (or replaces) the site-wide banner.
 */
export async function setAnnouncement(
  editor: User,
  input: { body: string; tone: AnnouncementTone; expiresAt: DateTime | null }
): Promise<Announcement> {
  const announcement: Announcement = {
    body: input.body,
    tone: input.tone,
    expiresAt: input.expiresAt?.toISO() ?? null,
    postedAt: DateTime.now().toISO() ?? '',
    postedByUsername: editor.username,
  }
  await writeSetting(ANNOUNCEMENT_KEY, announcement, editor)
  return announcement
}

/**
 * Takes the banner down.
 */
export async function clearAnnouncement(editor: User): Promise<void> {
  await writeSetting(ANNOUNCEMENT_KEY, null, editor)
}
