import { DateTime } from 'luxon'
import ChatMessage from '#models/chat_message'
import type User from '#models/user'
import { censorMessage } from '#services/profanity_filter'
import { isGroupMember } from '#services/group_service'
import { getMatch } from '#services/game/match_service'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Chat rules from docs/features.md: one message every 3 seconds in the
 * global chatroom and in-game chats, messages kept for 30 days, blocked
 * words masked.
 */
export const CHAT_RATE_LIMIT_MS = 3000
export const MESSAGE_RETENTION_DAYS = 30
export const MAX_MESSAGE_LENGTH = 500

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
 * Enforces one message per user every 3 seconds within a scope.
 *
 * @throws Exception (429) when the user posted too recently.
 */
function enforceRateLimit(scope: string, userId: number): void {
  const key = `${scope}:${userId}`
  const last = lastMessageAt.get(key)
  const now = Date.now()
  if (last !== undefined && now - last < CHAT_RATE_LIMIT_MS) {
    throw new Exception('You can only send one message every 3 seconds', {
      status: 429,
      code: 'E_CHAT_RATE_LIMITED',
    })
  }
  lastMessageAt.set(key, now)
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
 *   invalid, the user is not a member of the group, or the global
 *   rate limit is hit.
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
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new Exception(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters`, {
      status: 422,
      code: 'E_MESSAGE_TOO_LONG',
    })
  }

  if (channel.type === 'group') {
    if (!(await isGroupMember(channel.groupId, user.id))) {
      throw new Exception('Group not found', { status: 404, code: 'E_GROUP_NOT_FOUND' })
    }
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
