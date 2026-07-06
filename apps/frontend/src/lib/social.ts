import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * Data layer for friends and private groups. Response types flow from
 * the generated Tuyau client, so these hooks stay in sync with the
 * backend transformers.
 */

export interface PublicUser {
  id: number
  username: string
  avatarUrl: string | null
  initials: string
}

/** Pending requests and invites refresh on this interval until
 * realtime notifications arrive with the Socket.IO slice. */
const PENDING_REFETCH_INTERVAL = 30 * 1000

export const friendsQueryOptions = queryOptions({
  queryKey: ['social', 'friends'],
  queryFn: async () => {
    const response = await api.get('/api/v1/friends', {})
    return response.data.friends
  },
})

export const friendRequestsQueryOptions = queryOptions({
  queryKey: ['social', 'friendRequests'],
  queryFn: async () => {
    const response = await api.get('/api/v1/friend-requests', {})
    return response.data
  },
  refetchInterval: PENDING_REFETCH_INTERVAL,
})

export const groupsQueryOptions = queryOptions({
  queryKey: ['social', 'groups'],
  queryFn: async () => {
    const response = await api.get('/api/v1/groups', {})
    return response.data.groups
  },
})

export const groupInvitesQueryOptions = queryOptions({
  queryKey: ['social', 'groupInvites'],
  queryFn: async () => {
    const response = await api.get('/api/v1/group-invites', {})
    return response.data.invites
  },
  refetchInterval: PENDING_REFETCH_INTERVAL,
})

export function groupDetailQueryOptions(groupId: number) {
  return queryOptions({
    queryKey: ['social', 'group', groupId],
    queryFn: async () => {
      const response = await api.get('/api/v1/groups/:id', {
        params: { id: groupId },
      })
      return response.data.group
    },
  })
}

/**
 * Invalidates the given social query keys after a mutation.
 */
function useInvalidate() {
  const queryClient = useQueryClient()
  return (
    ...keys: (
      'friends' | 'friendRequests' | 'groups' | 'groupInvites' | 'group'
    )[]
  ) => {
    for (const key of keys) {
      void queryClient.invalidateQueries({ queryKey: ['social', key] })
    }
  }
}

export function useSendFriendRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (username: string) => {
      const response = await api.post('/api/v1/friend-requests', {
        body: { username },
      })
      return response.data.request
    },
    onSuccess: () => invalidate('friendRequests'),
  })
}

export function useAcceptFriendRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (requestId: number) => {
      const response = await api.post('/api/v1/friend-requests/:id/accept', {
        params: { id: requestId },
      })
      return response.data.friend
    },
    onSuccess: () => invalidate('friendRequests', 'friends'),
  })
}

export function useDeleteFriendRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (requestId: number) => {
      await api.delete('/api/v1/friend-requests/:id', {
        params: { id: requestId },
      })
    },
    onSuccess: () => invalidate('friendRequests'),
  })
}

export function useRemoveFriend() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (userId: number) => {
      await api.delete('/api/v1/friends/:userId', { params: { userId } })
    },
    onSuccess: () => invalidate('friends'),
  })
}

export function useCreateGroup() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await api.post('/api/v1/groups', { body: { name } })
      return response.data.group
    },
    onSuccess: () => invalidate('groups'),
  })
}

export function useInviteToGroup() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { groupId: number; username: string }) => {
      const response = await api.post('/api/v1/groups/:groupId/invites', {
        params: { groupId: input.groupId },
        body: { username: input.username },
      })
      return response.data.invite
    },
    onSuccess: () => invalidate('group'),
  })
}

export function useAcceptGroupInvite() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (inviteId: number) => {
      const response = await api.post('/api/v1/group-invites/:id/accept', {
        params: { id: inviteId },
      })
      return response.data
    },
    onSuccess: () => invalidate('groupInvites', 'groups'),
  })
}

export function useDeleteGroupInvite() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (inviteId: number) => {
      await api.delete('/api/v1/group-invites/:id', {
        params: { id: inviteId },
      })
    },
    onSuccess: () => invalidate('groupInvites', 'group'),
  })
}

export function useRemoveGroupMember() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { groupId: number; userId: number }) => {
      await api.delete('/api/v1/groups/:groupId/members/:userId', {
        params: { groupId: input.groupId, userId: input.userId },
      })
    },
    onSuccess: () => invalidate('groups', 'group'),
  })
}

export function useTransferOwnership() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { groupId: number; userId: number }) => {
      await api.post('/api/v1/groups/:id/transfer', {
        params: { id: input.groupId },
        body: { userId: input.userId },
      })
    },
    onSuccess: () => invalidate('groups', 'group'),
  })
}

export function useDeleteGroup() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (groupId: number) => {
      await api.delete('/api/v1/groups/:id', { params: { id: groupId } })
    },
    onSuccess: () => invalidate('groups', 'group'),
  })
}
