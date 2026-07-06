import { useEffect } from 'react'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api'
import { getSocket } from '#/lib/socket'
import type { PublicUser } from '#/lib/social'

/**
 * A chat channel: the public global chatroom, a group's chat, or a
 * live game's table chat.
 */
export type ChatChannel =
  | { type: 'global' }
  | { type: 'group'; groupId: number }
  | { type: 'match'; matchId: string }

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
  channel: 'global' | 'group' | 'match'
  groupId: number | null
  matchId: string | null
  message: ChatMessageItem
}

/**
 * Cache key for a channel's message list.
 */
export function chatQueryKey(channel: ChatChannel): (string | number)[] {
  if (channel.type === 'group') {
    return ['chat', 'group', channel.groupId]
  }
  if (channel.type === 'match') {
    return ['chat', 'match', channel.matchId]
  }
  return ['chat', 'global']
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
      if (channel.type === 'match') {
        const response = await api.get('/api/v1/matches/:matchId/messages', {
          params: { matchId: channel.matchId },
        })
        return response.data.messages
      }
      const response = await api.get('/api/v1/chat/global/messages', {})
      return response.data.messages
    },
  })
}

/**
 * Appends every live `chat:message` event to its channel's cache while
 * the calling component is mounted.
 */
export function useChatLiveUpdates(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    const onMessage = (event: IncomingChatMessage) => {
      let eventChannel: ChatChannel = { type: 'global' }
      if (event.channel === 'group' && event.groupId !== null) {
        eventChannel = { type: 'group', groupId: event.groupId }
      } else if (event.channel === 'match' && event.matchId !== null) {
        eventChannel = { type: 'match', matchId: event.matchId }
      }
      queryClient.setQueryData<ChatMessageItem[]>(
        chatQueryKey(eventChannel),
        (old) => (old ? [...old, event.message] : [event.message]),
      )
    }
    socket.on('chat:message', onMessage)
    return () => {
      socket.off('chat:message', onMessage)
    }
  }, [queryClient])
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
    channel.type === 'group'
      ? { channel: 'group', groupId: channel.groupId, body }
      : channel.type === 'match'
        ? { channel: 'match', matchId: channel.matchId, body }
        : { channel: 'global', body }

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
 * Joins a live game's chat room (players only; access is re-checked
 * server-side, and the server closes the room when the game ends).
 */
export function subscribeToMatchChat(matchId: string): void {
  getSocket().emit('chat:subscribe', { matchId })
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
