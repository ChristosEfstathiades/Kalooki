import { DateTime } from 'luxon'
import type User from '#models/user'

/**
 * Authorization levels, lowest first. They are hierarchical: every
 * level can do everything the levels below it can, so an admin is also
 * a moderator (docs/features.md, Roles & Moderation).
 *
 * This module is deliberately dependency-free (predicates only) so both
 * the chat service and the moderation service can use it without
 * creating an import cycle.
 */
export const USER_ROLES = ['player', 'moderator', 'admin'] as const

export type UserRole = (typeof USER_ROLES)[number]

const ROLE_RANK: Record<UserRole, number> = {
  player: 0,
  moderator: 1,
  admin: 2,
}

/**
 * Narrows an arbitrary string to a known role, defaulting unrecognised
 * values to the least privileged one so a bad row can never grant
 * powers it shouldn't.
 */
export function normalizeRole(role: string): UserRole {
  return (USER_ROLES as readonly string[]).includes(role) ? (role as UserRole) : 'player'
}

/**
 * True when the user's role is at least the given level.
 */
export function hasAtLeastRole(user: User, minimum: UserRole): boolean {
  return ROLE_RANK[normalizeRole(user.role)] >= ROLE_RANK[minimum]
}

/**
 * Whether a moderator or admin may take action against another user.
 * Acting requires a strictly higher role than the target, which stops
 * moderators policing each other and stops anyone banning themselves.
 */
export function canModerate(actor: User, target: User): boolean {
  if (actor.id === target.id) {
    return false
  }
  return ROLE_RANK[normalizeRole(actor.role)] > ROLE_RANK[normalizeRole(target.role)]
}

/**
 * A banned account still exists but cannot sign in and is dropped from
 * any live socket connection. Bans last until a moderator lifts them.
 */
export function isBanned(user: User): boolean {
  return user.bannedAt !== null
}

/**
 * A muted user can still read chat and play games but cannot post.
 * Mutes are either timed (mutedUntil in the future) or permanent
 * (mutedUntil null while mutedAt is set); a lapsed mutedUntil means the
 * mute has expired and no longer applies.
 */
export function isMuted(user: User): boolean {
  if (user.mutedAt === null) {
    return false
  }
  return user.mutedUntil === null || user.mutedUntil > DateTime.now()
}

/**
 * User-facing explanation of an active mute, for the error returned
 * when a muted user tries to post.
 */
export function muteNotice(user: User): string {
  const reason = user.muteReason ? ` Reason: ${user.muteReason}` : ''
  if (user.mutedUntil === null) {
    return `You are muted and cannot post in chat.${reason}`
  }
  return `You are muted until ${user.mutedUntil.toFormat('d LLL yyyy HH:mm')} and cannot post in chat.${reason}`
}
