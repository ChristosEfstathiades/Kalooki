import { searchChatMessages } from '#services/chat_search_service'
import { parseIsoBound, searchChatValidator } from '#validators/admin'
import type { HttpContext } from '@adonisjs/core/http'
import type { SearchableChannel } from '#services/chat_search_service'

/** Messages per page when the request does not ask for a size. */
const DEFAULT_PER_PAGE = 50

/**
 * The chat browser on admin.{domain}: search the global chatroom and
 * live game chats when investigating a user.
 *
 * Private group chats are not reachable from here, matching the rule
 * that moderation never reaches into a group's conversation
 * (docs/features.md, Roles & Moderation).
 */
export default class AdminChatController {
  /**
   * One page of matching messages, newest first.
   */
  async index({ request, serialize }: HttpContext) {
    const filters = await request.validateUsing(searchChatValidator, { data: request.qs() })

    const result = await searchChatMessages({
      page: filters.page ?? 1,
      perPage: filters.perPage ?? DEFAULT_PER_PAGE,
      search: filters.search ?? null,
      username: filters.username ?? null,
      channel: (filters.channel ?? 'all') as SearchableChannel | 'all',
      from: parseIsoBound(filters.from, 'from'),
      to: parseIsoBound(filters.to, 'to'),
      includeDeleted: filters.includeDeleted ?? false,
      censoredOnly: filters.censoredOnly ?? false,
      reportedOnly: filters.reportedOnly ?? false,
    })

    return serialize(result)
  }
}
