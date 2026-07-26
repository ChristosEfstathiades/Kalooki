import { DateTime } from 'luxon'
import ChatMessage from '#models/chat_message'
import type User from '#models/user'
import { censorMessage } from '#services/profanity_filter'
import { findDisallowedLinks } from '#services/link_filter'
import { isGroupMember } from '#services/group_service'
import {
  TRUSTED_ACCOUNT_AGE_DAYS,
  hasAtLeastRole,
  isMuted,
  isTrustedAccount,
  muteNotice,
} from '#services/role_service'
import { getMatch } from '#services/game/match_service'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Chat rules from docs/features.md: one message every second in every
 * chat, messages kept for 30 days, blocked words masked. The limit is
 * per scope, so a group chat and the global room do not share a
 * budget.
 */
export const CHAT_RATE_LIMIT_MS = 1000
export const MESSAGE_RETENTION_DAYS = 30
export const MAX_MESSAGE_LENGTH = 500

/**
 * Moderators and admins get a longer cap than players so they can post
 * announcements and explain a moderation decision in one message.
 * The `chat_messages.body` column is sized for this longer limit.
 */
export const MAX_STAFF_MESSAGE_LENGTH = 1000

/**
 * The longest message the given user may post.
 */
export function maxMessageLengthFor(user: User): number {
  return hasAtLeastRole(user, 'moderator') ? MAX_STAFF_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH
}

/**
 * Fixed palette a user can pick their chat name colour from (settings
 * page). Must match the frontend's copy in
 * apps/frontend/src/lib/username-color.ts, which also uses it as the
 * default hash-derived colour for users who haven't chosen one.
 */
export const CHAT_USERNAME_COLORS = [
  '#FF0000', // Red
  '#6495ED', // CornflowerBlue
  '#008000', // Green
  '#B22222', // Firebrick
  '#FF7F50', // Coral
  '#9ACD32', // YellowGreen
  '#FF4500', // OrangeRed
  '#2E8B57', // SeaGreen
  '#DAA520', // GoldenRod
  '#D2691E', // Chocolate
  '#5F9EA0', // CadetBlue
  '#1E90FF', // DodgerBlue
  '#FF69B4', // HotPink
  '#8A2BE2', // BlueViolet
  '#00FF7F', // SpringGreen
] as const

/** How many messages a chat loads when opened. */
const HISTORY_LIMIT = 100

/**
 * The channel a message belongs to: the public global chatroom, a
 * private group's chat, or a live game's table chat.
 */
export type ChatChannel =
  { type: 'global' } | { type: 'group'; groupId: number } | { type: 'match'; matchId: string }

/**
 * Asserts the user may use a match's chat: the game must still be
 * running and the user must be one of its players. Once the game ends
 * the messages become inaccessible (they stay in the database for the
 * retention window, associated with the game id, for moderation).
 * Practice matches (solo against bots) have no table chat, since bots
 * cannot post or read messages.
 *
 * @throws Exception (404) when the match is unknown, finished, is a
 *   practice match, or the user is not a player in it.
 */
export function assertMatchChatAccess(matchId: string, userId: number): void {
  const match = getMatch(matchId)
  if (
    !match ||
    match.finishedAt !== null ||
    match.kind === 'practice' ||
    !match.identities.has(userId)
  ) {
    throw new Exception('Match chat not found', { status: 404, code: 'E_MATCH_CHAT_NOT_FOUND' })
  }
}

/**
 * Per-user timestamps of the last message in each rate-limited scope
 * ('global' or a match id), keyed `scope:userId`. In-memory is fine
 * while the app runs as a single process.
 */
const lastMessageAt = new Map<string, number>()

/**
 * Clears rate-limit state. For tests, where user ids are reused across
 * rolled-back transactions while this map lives on.
 */
export function resetChatRateLimits(): void {
  lastMessageAt.clear()
}

/**
 * How many entries `lastMessageAt` may hold before a write sweeps the
 * expired ones. Keys are per user per scope (and every match id is its
 * own scope), so without this the map would grow for the life of the
 * process. Sweeping on a threshold rather than on every message keeps
 * the common path O(1).
 */
const RATE_LIMIT_SWEEP_THRESHOLD = 1000

/**
 * Drops entries whose window has already passed. They can only ever
 * allow the next message, so forgetting them changes no behaviour.
 */
function sweepExpiredRateLimits(now: number): void {
  for (const [key, at] of lastMessageAt) {
    if (now - at >= CHAT_RATE_LIMIT_MS) {
      lastMessageAt.delete(key)
    }
  }
}

/**
 * Enforces one message per user every second within a scope.
 *
 * @throws Exception (429) when the user posted too recently.
 */
function enforceRateLimit(scope: string, userId: number): void {
  const key = `${scope}:${userId}`
  const last = lastMessageAt.get(key)
  const now = Date.now()
  if (last !== undefined && now - last < CHAT_RATE_LIMIT_MS) {
    throw new Exception('You can only send one message every second', {
      status: 429,
      code: 'E_CHAT_RATE_LIMITED',
    })
  }
  if (lastMessageAt.size >= RATE_LIMIT_SWEEP_THRESHOLD) {
    sweepExpiredRateLimits(now)
  }
  lastMessageAt.set(key, now)
}

/**
 * Enforces the link rules from Developer/Chat-Moderation.md.
 *
 * Public chat (the global room and a game's table chat) may carry links
 * to our own site from anyone, so match history and replay links work,
 * but external links only from staff and from accounts old enough to be
 * trusted. That is the anti-throwaway measure: link spam is worth doing
 * only while a fresh account is free and instant.
 *
 * Private group chats are exempt entirely — they are invite-only, and
 * moderation deliberately never reaches into them (docs/features.md).
 *
 * @throws Exception (403) naming the hosts that are not allowed.
 */
function assertLinksAllowed(user: User, channel: ChatChannel, body: string): void {
  if (channel.type === 'group' || hasAtLeastRole(user, 'moderator') || isTrustedAccount(user)) {
    return
  }

  const disallowed = findDisallowedLinks(body)
  if (disallowed.length === 0) {
    return
  }

  throw new Exception(
    `You cannot post links to other sites (${disallowed.join(', ')}) until your account is ${TRUSTED_ACCOUNT_AGE_DAYS} days old`,
    { status: 403, code: 'E_LINKS_NOT_ALLOWED' }
  )
}

/**
 * Oldest creation time a message may have before the retention rules
 * hide (and eventually delete) it, as an SQL timestamp string.
 */
function retentionCutoffSql(): string {
  const cutoff = DateTime.now().minus({ days: MESSAGE_RETENTION_DAYS }).toSQL()
  if (!cutoff) {
    throw new Error('Failed to compute the chat retention cutoff timestamp')
  }
  return cutoff
}

/**
 * Validates, censors, rate-limits, and stores a chat message. Returns
 * the stored message with its author preloaded.
 *
 * @throws Exception with a user-facing message when the body is
 *   invalid, the user is muted, the user is not a member of the group,
 *   the message links somewhere they may not link to, or the rate
 *   limit is hit.
 */
export async function postChatMessage(
  user: User,
  channel: ChatChannel,
  rawBody: string
): Promise<ChatMessage> {
  const body = rawBody.trim()
  if (body === '') {
    throw new Exception('Message cannot be empty', { status: 422, code: 'E_EMPTY_MESSAGE' })
  }
  const lengthLimit = maxMessageLengthFor(user)
  if (body.length > lengthLimit) {
    throw new Exception(`Messages are limited to ${lengthLimit} characters`, {
      status: 422,
      code: 'E_MESSAGE_TOO_LONG',
    })
  }

  // Muted users keep playing and reading chat; only posting is blocked.
  if (isMuted(user)) {
    throw new Exception(muteNotice(user), { status: 403, code: 'E_USER_MUTED' })
  }

  assertLinksAllowed(user, channel, body)

  if (channel.type === 'group') {
    if (!(await isGroupMember(channel.groupId, user.id))) {
      throw new Exception('Group not found', { status: 404, code: 'E_GROUP_NOT_FOUND' })
    }
    enforceRateLimit(`group:${channel.groupId}`, user.id)
  } else if (channel.type === 'match') {
    assertMatchChatAccess(channel.matchId, user.id)
    enforceRateLimit(channel.matchId, user.id)
  } else {
    enforceRateLimit('global', user.id)
  }

  const { text, wasCensored } = censorMessage(body)
  const message = await ChatMessage.create({
    channel: channel.type,
    groupId: channel.type === 'group' ? channel.groupId : null,
    matchId: channel.type === 'match' ? channel.matchId : null,
    userId: user.id,
    body: text,
    wasCensored,
  })
  await message.load('user')
  return message
}

/**
 * Recent messages for a channel, oldest first, respecting retention.
 * Group membership / match chat access must be checked by the caller.
 */
export async function recentChatMessages(channel: ChatChannel): Promise<ChatMessage[]> {
  const query = ChatMessage.query()
    .where('createdAt', '>=', retentionCutoffSql())
    // Messages a moderator removed are hidden from everyone, author
    // included; the row survives for reports and the audit trail.
    .whereNull('deletedAt')
    .preload('user')
    .orderBy('createdAt', 'desc')
    .limit(HISTORY_LIMIT)

  if (channel.type === 'group') {
    query.where('channel', 'group').where('groupId', channel.groupId)
  } else if (channel.type === 'match') {
    query.where('channel', 'match').where('matchId', channel.matchId)
  } else {
    query.where('channel', 'global')
  }

  const messages = await query
  return messages.reverse()
}

/**
 * Deletes messages older than the retention window. Called
 * periodically by the socket provider while the server runs.
 */
export async function deleteExpiredChatMessages(): Promise<void> {
  await ChatMessage.query().where('createdAt', '<', retentionCutoffSql()).delete()
}
