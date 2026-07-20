import { useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api'
import { getSocket } from '#/lib/socket'
import { chatQueryKey } from '#/lib/chat'
import type { ChatChannel, ChatMessageItem } from '#/lib/chat'
import type { CurrentUser } from '#/lib/auth'

/**
 * Moderator tooling for the player site: deleting chat messages and
 * banning or muting users, plus the live events that back them.
 * Moderators are ordinary players with extra controls shown in place
 * (docs/features.md, Roles & Moderation).
 */

export type UserRole = 'player' | 'moderator' | 'admin'

const ROLE_RANK: Record<UserRole, number> = {
  player: 0,
  moderator: 1,
  admin: 2,
}

/**
 * Whether the signed-in user holds moderator powers. Admins do too,
 * since the roles are hierarchical.
 */
export function isModerator(user: CurrentUser | null | undefined): boolean {
  return user ? ROLE_RANK[normalizeRole(user.role)] >= ROLE_RANK.moderator : false
}

/**
 * Narrows a role string from the API to a known role, defaulting
 * anything unrecognised to the least privileged one.
 */
function normalizeRole(role: string): UserRole {
  return role in ROLE_RANK ? (role as UserRole) : 'player'
}

/**
 * Whether a moderator may act on another user. Acting requires a
 * strictly higher role, which is re-checked server-side; this only
 * decides whether the controls are worth showing.
 */
export function canModerate(
  actor: CurrentUser | null | undefined,
  targetRole: string,
  targetId: number,
): boolean {
  if (!actor || actor.id === targetId) {
    return false
  }
  return ROLE_RANK[normalizeRole(actor.role)] > ROLE_RANK[normalizeRole(targetRole)]
}

/** Mute lengths offered in the UI. Null is a permanent mute. */
export const MUTE_DURATIONS: Array<{ label: string; minutes: number | null }> = [
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: '7 days', minutes: 60 * 24 * 7 },
  { label: 'Permanent', minutes: null },
]

/**
 * Deletes a chat message. The server broadcasts the removal, so the
 * cache update arrives through useChatModerationUpdates rather than
 * being applied optimistically here.
 */
export function useDeleteMessage() {
  return useMutation({
    mutationFn: async (input: { messageId: number; reason?: string }) => {
      const response = await api.delete('/api/v1/moderation/messages/:id', {
        params: { id: input.messageId },
        body: { ...(input.reason ? { reason: input.reason } : {}) },
      })
      return response.data
    },
  })
}

/**
 * Bans a user. The server revokes their tokens and drops their live
 * sockets, so the ban takes effect immediately.
 */
export function useBanUser() {
  return useMutation({
    mutationFn: async (input: { userId: number; reason?: string }) => {
      const response = await api.post('/api/v1/moderation/users/:userId/ban', {
        params: { userId: input.userId },
        body: { ...(input.reason ? { reason: input.reason } : {}) },
      })
      return response.data
    },
  })
}

/**
 * Mutes a user for a fixed number of minutes, or permanently when
 * durationMinutes is null.
 */
export function useMuteUser() {
  return useMutation({
    mutationFn: async (input: {
      userId: number
      durationMinutes: number | null
      reason?: string
    }) => {
      const response = await api.post('/api/v1/moderation/users/:userId/mute', {
        params: { userId: input.userId },
        body: {
          durationMinutes: input.durationMinutes,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      })
      return response.data
    },
  })
}

/**
 * Payload of a live `chat:message-deleted` event.
 */
interface MessageDeletedEvent {
  channel: 'global' | 'group' | 'match'
  groupId: number | null
  matchId: string | null
  messageId: number
}

/**
 * Drops moderator-deleted messages out of their channel's cache while
 * the calling component is mounted, so a removal is reflected for
 * everyone watching without a refresh.
 */
export function useChatModerationUpdates(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    const socket = getSocket()
    const onDeleted = (event: MessageDeletedEvent) => {
      let channel: ChatChannel = { type: 'global' }
      if (event.channel === 'group' && event.groupId !== null) {
        channel = { type: 'group', groupId: event.groupId }
      } else if (event.channel === 'match' && event.matchId !== null) {
        channel = { type: 'match', matchId: event.matchId }
      }
      queryClient.setQueryData<ChatMessageItem[]>(
        chatQueryKey(channel),
        (old) => old?.filter((message) => message.id !== event.messageId),
      )
    }
    socket.on('chat:message-deleted', onDeleted)
    return () => {
      socket.off('chat:message-deleted', onDeleted)
    }
  }, [queryClient])
}
