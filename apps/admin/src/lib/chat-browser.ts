import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * Data layer for the chat browser. Only the global chatroom and live
 * game chats are searchable: private group chats are out of reach for
 * moderation, so they are out of reach here too.
 */

export type ChatChannelFilter = 'global' | 'match' | 'all'

export const CHAT_CHANNELS: Array<{ value: ChatChannelFilter; label: string }> =
  [
    { value: 'all', label: 'All channels' },
    { value: 'global', label: 'Global chat' },
    { value: 'match', label: 'In-game chat' },
  ]

export interface ChatSearchFilters {
  page: number
  search: string
  username: string
  channel: ChatChannelFilter
  from: string
  to: string
  includeDeleted: boolean
  censoredOnly: boolean
  reportedOnly: boolean
}

export const EMPTY_CHAT_FILTERS: ChatSearchFilters = {
  page: 1,
  search: '',
  username: '',
  channel: 'all',
  from: '',
  to: '',
  includeDeleted: false,
  censoredOnly: false,
  reportedOnly: false,
}

/**
 * Turns a date input's `YYYY-MM-DD` value into the ISO timestamp the
 * API expects, or undefined when the field is empty.
 */
function isoBound(value: string): string | undefined {
  if (value === '') {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

async function fetchChatMessages(filters: ChatSearchFilters) {
  const from = isoBound(filters.from)
  const to = isoBound(filters.to)

  const response = await api.get('/api/v1/admin/chat/messages', {
    query: {
      page: filters.page,
      channel: filters.channel,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.username ? { username: filters.username } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(filters.includeDeleted ? { includeDeleted: true } : {}),
      ...(filters.censoredOnly ? { censoredOnly: true } : {}),
      ...(filters.reportedOnly ? { reportedOnly: true } : {}),
    },
  })
  return response.data
}

export type AdminChatMessage = Awaited<
  ReturnType<typeof fetchChatMessages>
>['messages'][number]

export function chatMessagesQueryOptions(filters: ChatSearchFilters) {
  return queryOptions({
    queryKey: ['admin', 'chat', filters],
    queryFn: () => fetchChatMessages(filters),
  })
}
