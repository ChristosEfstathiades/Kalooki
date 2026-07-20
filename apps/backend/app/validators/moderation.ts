import vine from '@vinejs/vine'
import { USER_ROLES } from '#services/role_service'
import { MUTE_DURATIONS_MINUTES } from '#services/moderation_service'

/** Free-text note a moderator can attach to any action. */
const reason = vine.string().trim().maxLength(500).optional()

/**
 * Validator for deleting a chat message as a moderator.
 */
export const deleteMessageValidator = vine.create({ reason })

/**
 * Validator for banning a user. Bans are indefinite, so only a reason
 * is accepted.
 */
export const banUserValidator = vine.create({ reason })

/**
 * Validator for muting a user. durationMinutes must be one of the fixed
 * lengths the UI offers, or null for a permanent mute.
 */
export const muteUserValidator = vine.create({
  durationMinutes: vine
    .number()
    .in([...MUTE_DURATIONS_MINUTES])
    .nullable(),
  reason,
})

/**
 * Validator for lifting a ban or mute.
 */
export const liftModerationValidator = vine.create({ reason })

/**
 * Validator for an admin changing a user's role.
 */
export const setUserRoleValidator = vine.create({
  role: vine.enum([...USER_ROLES]),
})

/**
 * Validator for the admin user list: page through users, optionally
 * filtering by a username/email search term or by role.
 */
export const listUsersValidator = vine.create({
  page: vine.number().positive().optional(),
  perPage: vine.number().positive().max(100).optional(),
  search: vine.string().trim().maxLength(254).optional(),
  role: vine.enum([...USER_ROLES]).optional(),
})
