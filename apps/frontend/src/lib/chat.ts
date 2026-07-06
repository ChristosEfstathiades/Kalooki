import { queryOptions, useMutation } from '@tanstack/react-query'
import { api } from '#/lib/api'
import { getSocket } from '#/lib/socket'
import type { PublicUser } from '#/lib/social'

/**
 * A chat channel: the public global chatroom or a group's chat.
 */
export type ChatChannel =
  { type: 'global' } | { type: 'group'; groupId: number }

export interface ChatMessageItem {
  id: number
  body: string
  createdAt: string | null
  user: PublicUser
}

/**
 * Payload of a live `chat:message` event from the server.
 */
export interface IncomingChatMessage {
  channel: 'global' | 'group'
  groupId: number | null
  message: ChatMessageItem
}

/**
 * Cache key for a channel's message list.
 */
export function chatQueryKey(channel: ChatChannel): (string | number)[] {
  return channel.type === 'global'
    ? ['chat', 'global']
    : ['chat', 'group', channel.groupId]
}

/**
 * Recent history for a channel; live messages arrive over the socket
 * and are appended to this cache.
 */
export function chatHistoryQueryOptions(channel: ChatChannel) {
  return queryOptions<ChatMessageItem[]>({
    queryKey: chatQueryKey(channel),
    queryFn: async () => {
      if (channel.type === 'group') {
        const response = await api.get('/api/v1/groups/:groupId/messages', {
          params: { groupId: channel.groupId },
        })
        return response.data.messages
      }
      const response = await api.get('/api/v1/chat/global/messages', {})
      return response.data.messages
    },
  })
}

interface SendAck {
  ok: boolean
  error?: string
}

/**
 * Sends a chat message over the socket and resolves once the server
 * acknowledges it. Rejects with the server's reason (rate limit,
 * empty message, …) so the UI can show it.
 */
export function sendChatMessage(
  channel: ChatChannel,
  body: string,
): Promise<void> {
  const payload =
    channel.type === 'global'
      ? { channel: 'global', body }
      : { channel: 'group', groupId: channel.groupId, body }

  return new Promise((resolve, reject) => {
    getSocket()
      .timeout(10000)
      .emit(
        'chat:send',
        payload,
        (timeoutError: Error | null, ack: SendAck) => {
          if (timeoutError) {
            reject(
              new Error('The server did not respond — check your connection'),
            )
          } else if (!ack.ok) {
            reject(new Error(ack.error ?? 'Could not send the message'))
          } else {
            resolve()
          }
        },
      )
  })
}

/**
 * Joins a group's chat room (idempotent; membership is re-checked
 * server-side). Needed when the user joined the group after the
 * socket connected.
 */
export function subscribeToGroupChat(groupId: number): void {
  getSocket().emit('chat:subscribe', { groupId })
}

/**
 * Reports a message to the moderators.
 */
export function useReportMessage() {
  return useMutation({
    mutationFn: async (messageId: number) => {
      await api.post('/api/v1/chat/messages/:id/report', {
        params: { id: messageId },
      })
    },
  })
}
