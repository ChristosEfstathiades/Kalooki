import { useEffect } from 'react'
import { queryOptions, useQueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api'
import { getSocket } from '#/lib/socket'
import { friendsQueryOptions } from '#/lib/social'
import type { QueryClient } from '@tanstack/react-query'

/**
 * Who is online. The count and each friend's status are read once over
 * HTTP, then kept current by the presence events the socket server
 * pushes (`presence:count` to everyone, `presence:friend` to friends).
 */

/** Fallback poll for pages with no socket, e.g. a signed-out visitor. */
const COUNT_POLL_INTERVAL = 60 * 1000

export interface OnlineCountEvent {
  count: number
}

export interface FriendPresenceEvent {
  userId: number
  online: boolean
}

export const onlineCountQueryOptions = queryOptions({
  queryKey: ['presence', 'count'],
  queryFn: async () => {
    const response = await api.get('/api/v1/presence', {})
    return response.data.online
  },
  refetchInterval: COUNT_POLL_INTERVAL,
})

/**
 * Writes a friend's new status into the cached friends list, so the
 * list re-renders without another request.
 */
function applyFriendPresence(
  queryClient: QueryClient,
  event: FriendPresenceEvent,
): void {
  queryClient.setQueryData(friendsQueryOptions.queryKey, (friends) =>
    friends?.map((friend) =>
      friend.id === event.userId ? { ...friend, online: event.online } : friend,
    ),
  )
}

/**
 * Subscribes to presence events for as long as the component is
 * mounted. Mount this once, high in the signed-in tree.
 */
export function usePresenceSync(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()

    const onCount = (event: OnlineCountEvent) => {
      queryClient.setQueryData(onlineCountQueryOptions.queryKey, event.count)
    }
    const onFriend = (event: FriendPresenceEvent) => {
      applyFriendPresence(queryClient, event)
    }
    // Events sent while the socket was down are gone, so re-read the
    // list rather than trusting a stale one after a reconnect.
    const onConnect = () => {
      void queryClient.invalidateQueries({ queryKey: ['social', 'friends'] })
    }

    socket.on('presence:count', onCount)
    socket.on('presence:friend', onFriend)
    socket.on('connect', onConnect)
    return () => {
      socket.off('presence:count', onCount)
      socket.off('presence:friend', onFriend)
      socket.off('connect', onConnect)
    }
  }, [queryClient])
}
