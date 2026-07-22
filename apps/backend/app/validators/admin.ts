import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import { ANNOUNCEMENT_TONES } from '#services/site_settings_service'
import { SEARCHABLE_CHANNELS } from '#services/chat_search_service'
import { MODERATION_ACTION_NAMES } from '#models/moderation_action'

/**
 * Validators for the admin-only endpoints backing admin.{domain}:
 * the report queue, the chat browser, the audit log, news, the
 * operational switches and the stats tools.
 */

/** Free-text note an admin can attach to a decision. */
const note = vine.string().trim().maxLength(500).optional()

/** Page number shared by every paginated admin list. */
const page = vine.number().positive().optional()

/** Page size, capped so one request cannot pull the whole table. */
const perPage = vine.number().positive().max(100).optional()

/** ISO timestamp bound on a list, validated when it is parsed. */
const isoDate = vine.string().trim().maxLength(40).optional()

/**
 * Turns an optional ISO date filter into a DateTime, or null when it
 * was not supplied. Kept out of the schemas because VineJS returns a
 * plain Date, and every consumer here wants Luxon.
 *
 * @throws Exception (422) when the value is not a valid ISO timestamp.
 */
export function parseIsoBound(value: string | undefined, field: string): DateTime | null {
  if (value === undefined || value === '') {
    return null
  }
  const parsed = DateTime.fromISO(value)
  if (!parsed.isValid) {
    throw new Exception(`${field} must be an ISO date`, {
      status: 422,
      code: 'E_INVALID_DATE_FILTER',
    })
  }
  return parsed
}

/**
 * Validator for the report queue: which slice, in what order, filtered
 * by channel and a search over the body or the author's name.
 */
export const listReportsValidator = vine.create({
  page,
  perPage,
  status: vine.enum(['open', 'resolved', 'all']).optional(),
  sort: vine.enum(['recent', 'oldest', 'most-reported']).optional(),
  channel: vine.enum(['global', 'group', 'match', 'all']).optional(),
  search: vine.string().trim().maxLength(200).optional(),
})

/**
 * Validator for closing every open report against one message.
 */
export const resolveReportValidator = vine.create({
  outcome: vine.enum(['actioned', 'dismissed']),
  note,
})

/**
 * Validator for the "who is causing trouble" list.
 */
export const listReportedAuthorsValidator = vine.create({
  limit: vine.number().positive().max(100).optional(),
})

/**
 * Validator for the chat browser. Group chats are not searchable, so
 * the channel filter only offers the moderatable ones.
 */
export const searchChatValidator = vine.create({
  page,
  perPage,
  search: vine.string().trim().maxLength(200).optional(),
  username: vine.string().trim().maxLength(32).optional(),
  channel: vine.enum([...SEARCHABLE_CHANNELS, 'all']).optional(),
  from: isoDate,
  to: isoDate,
  includeDeleted: vine.boolean().optional(),
  censoredOnly: vine.boolean().optional(),
  reportedOnly: vine.boolean().optional(),
})

/**
 * Validator for the filterable audit log.
 */
export const listModerationActionsValidator = vine.create({
  page,
  perPage,
  action: vine.enum([...MODERATION_ACTION_NAMES]).optional(),
  actor: vine.string().trim().maxLength(32).optional(),
  target: vine.string().trim().maxLength(32).optional(),
  from: isoDate,
  to: isoDate,
})

/**
 * Validator for publishing a news item. publishedAt drives both the
 * displayed date and the ordering, so it defaults to now rather than
 * being required.
 */
export const createNewsValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(1000),
  publishedAt: isoDate,
  isPublished: vine.boolean().optional(),
  isPinned: vine.boolean().optional(),
})

/**
 * Validator for editing a news item; every field is optional so the
 * admin app can toggle "pinned" without resending the body.
 */
export const updateNewsValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(1000).optional(),
  publishedAt: isoDate,
  isPublished: vine.boolean().optional(),
  isPinned: vine.boolean().optional(),
})

/**
 * Validator for the operational switches. Every flag is optional, so a
 * request changes only the switches it names.
 */
export const siteFlagsValidator = vine.create({
  maintenanceMode: vine.boolean().optional(),
  signupsEnabled: vine.boolean().optional(),
  publicMatchmakingEnabled: vine.boolean().optional(),
  practiceGamesEnabled: vine.boolean().optional(),
})

/**
 * Validator for raising the site-wide banner.
 */
export const announcementValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(500),
  tone: vine.enum([...ANNOUNCEMENT_TONES]).optional(),
  durationMinutes: vine
    .number()
    .positive()
    .max(60 * 24 * 30)
    .nullable()
    .optional(),
  alsoPostToChat: vine.boolean().optional(),
})

/**
 * Validator for a one-off system line in the global chatroom.
 */
export const globalNoticeValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(500),
})

/**
 * Validator for hiding or restoring an account on the leaderboard.
 */
export const leaderboardExclusionValidator = vine.create({
  excluded: vine.boolean(),
  reason: note,
})

/**
 * Validator for deleting a player's recorded seats. The destructive
 * option must be asked for explicitly rather than defaulting on.
 */
export const wipeStatsValidator = vine.create({
  includePrivate: vine.boolean().optional(),
  reason: note,
})
