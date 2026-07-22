import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import ChatMessage from '#models/chat_message'
import type User from '#models/user'

/**
 * Search across the chat an admin is allowed to see, for investigating
 * a user beyond the single line that got reported.
 *
 * Private group chats are deliberately excluded, exactly as they are
 * from moderator deletion (docs/features.md): moderation never reaches
 * into a group's conversation, so it must not be searchable either.
 */

/** Channels the browser can return. Mirrors the deletable channels. */
export const SEARCHABLE_CHANNELS = ['global', 'match'] as const

export type SearchableChannel = (typeof SEARCHABLE_CHANNELS)[number]

export interface ChatSearchFilters {
  page: number
  perPage: number
  /** Matches the message body, case-insensitively. */
  search: string | null
  /** Restrict to one author by exact username. */
  username: string | null
  channel: SearchableChannel | 'all'
  /** Inclusive lower bound on when the message was posted. */
  from: DateTime | null
  /** Exclusive upper bound on when the message was posted. */
  to: DateTime | null
  /** Include messages a moderator already deleted. */
  includeDeleted: boolean
  /** Only messages the profanity filter masked. */
  censoredOnly: boolean
  /** Only messages someone has reported. */
  reportedOnly: boolean
}

/**
 * One message as the admin browser shows it: the body, its author's
 * moderation-relevant identity, and whether it has been acted on.
 */
function adminChatMessageShape(message: ChatMessage, reportCount: number) {
  const author = message.user as User | undefined

  return {
    id: message.id,
    body: message.body,
    channel: message.channel,
    groupId: message.groupId,
    matchId: message.matchId,
    wasCensored: Boolean(message.wasCensored),
    createdAt: message.createdAt.toISO(),
    deletedAt: message.deletedAt?.toISO() ?? null,
    reportCount,
    author: author ? { id: author.id, username: author.username, role: author.role } : null,
  }
}

export type AdminChatMessage = ReturnType<typeof adminChatMessageShape>

/**
 * Builds the filtered message query, without ordering or paging so the
 * same shape can be counted and listed.
 */
function filteredMessages(filters: ChatSearchFilters) {
  const query = ChatMessage.query().whereIn('channel', [...SEARCHABLE_CHANNELS])

  if (filters.channel !== 'all') {
    query.where('channel', filters.channel)
  }
  if (filters.search) {
    query.whereRaw('lower(body) like ?', [`%${filters.search.toLowerCase()}%`])
  }
  if (filters.username) {
    query.whereIn(
      'userId',
      db
        .from('users')
        .whereRaw('lower(username) = ?', [filters.username.toLowerCase()])
        .select('id')
    )
  }
  if (filters.from) {
    query.where('createdAt', '>=', filters.from.toSQL() ?? '')
  }
  if (filters.to) {
    query.where('createdAt', '<', filters.to.toSQL() ?? '')
  }
  if (!filters.includeDeleted) {
    query.whereNull('deletedAt')
  }
  if (filters.censoredOnly) {
    query.where('wasCensored', true)
  }
  if (filters.reportedOnly) {
    query.whereIn('id', db.from('message_reports').select('message_id'))
  }

  return query
}

/**
 * Counts the reports standing against each of the given messages, so
 * the browser can flag a line that has already been reported.
 */
export async function reportCountsFor(messageIds: number[]): Promise<Map<number, number>> {
  if (messageIds.length === 0) {
    return new Map()
  }
  const rows = await db
    .from('message_reports')
    .whereIn('message_id', messageIds)
    .groupBy('message_id')
    .select('message_id as messageId')
    .count('* as total')

  return new Map(rows.map((row) => [Number(row.messageId), Number(row.total)]))
}

/**
 * One page of matching messages, newest first.
 */
export async function searchChatMessages(filters: ChatSearchFilters) {
  const paginator = await filteredMessages(filters)
    .preload('user')
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .paginate(filters.page, filters.perPage)

  const messages = paginator.all()
  const reportCounts = await reportCountsFor(messages.map((message) => message.id))

  return {
    messages: messages.map((message) =>
      adminChatMessageShape(message, reportCounts.get(message.id) ?? 0)
    ),
    meta: {
      page: paginator.currentPage,
      perPage: paginator.perPage,
      total: paginator.total,
      lastPage: paginator.lastPage,
    },
  }
}

/**
 * A user's most recent visible chat lines, for their dossier.
 */
export async function recentMessagesByUser(
  userId: number,
  limit: number
): Promise<AdminChatMessage[]> {
  const messages = await ChatMessage.query()
    .where('userId', userId)
    .whereIn('channel', [...SEARCHABLE_CHANNELS])
    .preload('user')
    .orderBy('createdAt', 'desc')
    .limit(limit)

  const reportCounts = await reportCountsFor(messages.map((message) => message.id))
  return messages.map((message) =>
    adminChatMessageShape(message, reportCounts.get(message.id) ?? 0)
  )
}
