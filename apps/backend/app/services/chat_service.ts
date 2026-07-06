import { DateTime } from 'luxon'
import ChatMessage from '#models/chat_message'
import type User from '#models/user'
import { censorMessage } from '#services/profanity_filter'
import { isGroupMember } from '#services/group_service'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Chat rules from docs/features.md: one message every 3 seconds in the
 * global chatroom, messages kept for 7 days, blocked words masked.
 */
export const GLOBAL_CHAT_RATE_LIMIT_MS = 3000
export const MESSAGE_RETENTION_DAYS = 7
export const MAX_MESSAGE_LENGTH = 500

/** How many messages a chat loads when opened. */
const HISTORY_LIMIT = 100

/**
 * The channel a message belongs to: the public global chatroom or a
 * private group's chat.
 */
export type ChatChannel = { type: 'global' } | { type: 'group'; groupId: number }

/**
 * Per-user timestamps of the last global message, for rate limiting.
 * In-memory is fine while the app runs as a single process.
 */
const lastGlobalMessageAt = new Map<number, number>()

/**
 * Clears rate-limit state. For tests, where user ids are reused across
 * rolled-back transactions while this map lives on.
 */
export function resetChatRateLimits(): void {
  lastGlobalMessageAt.clear()
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
  } else {
    const last = lastGlobalMessageAt.get(user.id)
    const now = Date.now()
    if (last !== undefined && now - last < GLOBAL_CHAT_RATE_LIMIT_MS) {
      throw new Exception('You can only send one message every 3 seconds', {
        status: 429,
        code: 'E_CHAT_RATE_LIMITED',
      })
    }
    lastGlobalMessageAt.set(user.id, now)
  }

  const { text, wasCensored } = censorMessage(body)
  const message = await ChatMessage.create({
    channel: channel.type,
    groupId: channel.type === 'group' ? channel.groupId : null,
    userId: user.id,
    body: text,
    wasCensored,
  })
  await message.load('user')
  return message
}

/**
 * Recent messages for a channel, oldest first, respecting retention.
 * Group membership must be checked by the caller.
 */
export async function recentChatMessages(channel: ChatChannel): Promise<ChatMessage[]> {
  const query = ChatMessage.query()
    .where('createdAt', '>=', retentionCutoffSql())
    .preload('user')
    .orderBy('createdAt', 'desc')
    .limit(HISTORY_LIMIT)

  if (channel.type === 'group') {
    query.where('channel', 'group').where('groupId', channel.groupId)
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
