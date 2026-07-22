import { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import ChatMessage from '#models/chat_message'
import ModerationAction from '#models/moderation_action'
import User from '#models/user'
import { canModerate, isBanned, isMuted } from '#services/role_service'
import { broadcastMessageDeleted, disconnectUser } from '#services/socket_service'
import type { ModerationActionName } from '#models/moderation_action'
import type { UserRole } from '#services/role_service'
import type { ChatChannel } from '#services/chat_service'

/**
 * Moderator and admin actions: deleting chat messages, banning, muting,
 * and (admins only) changing roles. Every action writes a row to the
 * moderation_actions audit trail (docs/features.md, Roles & Moderation).
 *
 * Authorization is enforced here rather than in the controllers so the
 * same rules apply however an action is reached.
 */

/** Mute lengths a moderator can pick, in minutes. Null is permanent. */
export const MUTE_DURATIONS_MINUTES = [60, 60 * 24, 60 * 24 * 7] as const

/** Channels a moderator may delete messages from. Private group chats
 * are excluded so moderation never reaches into a group's conversation. */
const MODERATABLE_CHANNELS = ['global', 'match']

export interface RecordActionInput {
  action: ModerationActionName
  actor: User
  target?: User | null
  message?: ChatMessage | null
  reason?: string | null
  details?: Record<string, unknown> | null
}

/**
 * Writes one entry to the moderation audit trail, snapshotting the
 * usernames and (for deletions) the message body so the history stays
 * readable after the underlying rows are gone. Exported so the admin
 * services (reports, news, settings) log through the same trail.
 */
export async function recordAction(input: RecordActionInput): Promise<ModerationAction> {
  return ModerationAction.create({
    action: input.action,
    actorId: input.actor.id,
    actorUsername: input.actor.username,
    actorRole: input.actor.role,
    targetUserId: input.target?.id ?? null,
    targetUsername: input.target?.username ?? null,
    messageId: input.message?.id ?? null,
    messageChannel: input.message?.channel ?? null,
    messageBody: input.message?.body ?? null,
    reason: input.reason ?? null,
    details: input.details ? JSON.stringify(input.details) : null,
  })
}

/**
 * Loads the user an action targets.
 *
 * @throws Exception (404) when no such user exists.
 */
export async function findModerationTarget(userId: number): Promise<User> {
  const target = await User.find(userId)
  if (!target) {
    throw new Exception('User not found', { status: 404, code: 'E_USER_NOT_FOUND' })
  }
  return target
}

/**
 * Asserts the actor outranks the target.
 *
 * @throws Exception (403) when the actor may not act on this user.
 */
function assertCanModerate(actor: User, target: User): void {
  if (!canModerate(actor, target)) {
    throw new Exception('You are not allowed to moderate this user', {
      status: 403,
      code: 'E_MODERATION_FORBIDDEN',
    })
  }
}

/**
 * Deletes a chat message from the global chatroom or a live game's
 * table chat. The row is soft-deleted so outstanding reports stay
 * actionable, and the removal is pushed to everyone in the channel.
 *
 * @throws Exception (404) when the message does not exist or has
 *   already been deleted, or (403) for a private group's chat.
 */
export async function deleteChatMessage(
  actor: User,
  messageId: number,
  reason?: string | null
): Promise<ChatMessage> {
  const message = await ChatMessage.find(messageId)
  if (!message || message.deletedAt !== null) {
    throw new Exception('Message not found', { status: 404, code: 'E_MESSAGE_NOT_FOUND' })
  }
  if (!MODERATABLE_CHANNELS.includes(message.channel)) {
    throw new Exception('Private group messages cannot be moderated', {
      status: 403,
      code: 'E_MODERATION_FORBIDDEN',
    })
  }

  message.deletedAt = DateTime.now()
  message.deletedBy = actor.id
  await message.save()

  await recordAction({ action: 'message.delete', actor, message, reason })

  const channel: ChatChannel =
    message.channel === 'match' && message.matchId !== null
      ? { type: 'match', matchId: message.matchId }
      : { type: 'global' }
  broadcastMessageDeleted(channel, message.id)

  return message
}

/**
 * Bans a user: the account survives but can no longer sign in. Existing
 * access tokens are revoked and live sockets dropped so the ban applies
 * immediately rather than whenever the session next expires.
 *
 * @throws Exception (403) when the actor does not outrank the target,
 *   or (409) when the user is already banned.
 */
export async function banUser(actor: User, target: User, reason?: string | null): Promise<User> {
  assertCanModerate(actor, target)
  if (isBanned(target)) {
    throw new Exception('This user is already banned', {
      status: 409,
      code: 'E_ALREADY_BANNED',
    })
  }

  target.bannedAt = DateTime.now()
  target.bannedBy = actor.id
  target.banReason = reason ?? null
  await target.save()

  await revokeAllAccessTokens(target)
  disconnectUser(target.id, 'Your account has been banned.')

  await recordAction({ action: 'user.ban', actor, target, reason })
  return target
}

/**
 * Lifts a ban, letting the user sign in again.
 *
 * @throws Exception (403) when the actor does not outrank the target,
 *   or (409) when the user is not banned.
 */
export async function unbanUser(actor: User, target: User, reason?: string | null): Promise<User> {
  assertCanModerate(actor, target)
  if (!isBanned(target)) {
    throw new Exception('This user is not banned', { status: 409, code: 'E_NOT_BANNED' })
  }

  target.bannedAt = null
  target.bannedBy = null
  target.banReason = null
  await target.save()

  await recordAction({ action: 'user.unban', actor, target, reason })
  return target
}

/**
 * Mutes a user for a number of minutes, or permanently when
 * durationMinutes is null. Muted users keep playing and reading chat;
 * only posting is blocked.
 *
 * @throws Exception (403) when the actor does not outrank the target,
 *   or (422) when the duration is not a positive whole number.
 */
export async function muteUser(
  actor: User,
  target: User,
  options: { durationMinutes: number | null; reason?: string | null }
): Promise<User> {
  assertCanModerate(actor, target)

  const { durationMinutes } = options
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes <= 0)) {
    throw new Exception('Mute duration must be a positive number of minutes', {
      status: 422,
      code: 'E_INVALID_MUTE_DURATION',
    })
  }

  target.mutedAt = DateTime.now()
  target.mutedUntil =
    durationMinutes === null ? null : DateTime.now().plus({ minutes: durationMinutes })
  target.mutedBy = actor.id
  target.muteReason = options.reason ?? null
  await target.save()

  await recordAction({
    action: 'user.mute',
    actor,
    target,
    reason: options.reason,
    details: { durationMinutes, mutedUntil: target.mutedUntil?.toISO() ?? null },
  })
  return target
}

/**
 * Lifts a mute early.
 *
 * @throws Exception (403) when the actor does not outrank the target,
 *   or (409) when the user is not muted.
 */
export async function unmuteUser(actor: User, target: User, reason?: string | null): Promise<User> {
  assertCanModerate(actor, target)
  if (!isMuted(target)) {
    throw new Exception('This user is not muted', { status: 409, code: 'E_NOT_MUTED' })
  }

  clearMuteColumns(target)
  await target.save()

  await recordAction({ action: 'user.unmute', actor, target, reason })
  return target
}

/**
 * Changes a user's role. Admin only (enforced by the route's role
 * middleware); an admin cannot change their own role, which also stops
 * the last admin demoting themselves out of the admin site.
 *
 * @throws Exception (403) when the target is the actor, or (409) when
 *   the user already holds that role.
 */
export async function setUserRole(actor: User, target: User, role: UserRole): Promise<User> {
  if (actor.id === target.id) {
    throw new Exception('You cannot change your own role', {
      status: 403,
      code: 'E_MODERATION_FORBIDDEN',
    })
  }
  if (target.role === role) {
    throw new Exception(`This user is already ${role === 'admin' ? 'an' : 'a'} ${role}`, {
      status: 409,
      code: 'E_ROLE_UNCHANGED',
    })
  }

  const previousRole = target.role
  target.role = role
  await target.save()

  await recordAction({
    action: 'user.role',
    actor,
    target,
    details: { from: previousRole, to: role },
  })
  return target
}

/**
 * Clears an expired mute's columns so the account's stored state
 * matches how it is treated. Called when a lapsed mute is noticed.
 */
export function clearMuteColumns(user: User): void {
  user.mutedAt = null
  user.mutedUntil = null
  user.mutedBy = null
  user.muteReason = null
}

/**
 * Revokes every access token a user holds, signing them out of all
 * devices.
 */
async function revokeAllAccessTokens(user: User): Promise<void> {
  const tokens = await User.accessTokens.all(user)
  for (const token of tokens) {
    await User.accessTokens.delete(user, token.identifier)
  }
}
