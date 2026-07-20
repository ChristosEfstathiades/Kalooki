import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api'
import type { Data } from '@KalookiOnline/backend/data'

/**
 * Data layer for the admin app: the user directory and the moderation
 * audit feed. Response types flow from the generated Tuyau client, so
 * these stay in sync with the backend transformers.
 */

export type UserRole = 'player' | 'moderator' | 'admin'

export const USER_ROLES: UserRole[] = ['player', 'moderator', 'admin']

/** Mute lengths offered in the UI. Null is a permanent mute. */
export const MUTE_DURATIONS: Array<{ label: string; minutes: number | null }> = [
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: '7 days', minutes: 60 * 24 * 7 },
  { label: 'Permanent', minutes: null },
]

export interface UserListFilters {
  page: number
  search: string
  role: UserRole | 'all'
}

/**
 * One page of the user directory, filtered by search term and role.
 */
export function usersQueryOptions(filters: UserListFilters) {
  return queryOptions({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const response = await api.get('/api/v1/admin/users', {
        query: {
          page: filters.page,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.role !== 'all' ? { role: filters.role } : {}),
        },
      })
      return response.data
    },
  })
}

export type AdminUser = Data.ModerationUser

/**
 * The most recent moderator and admin actions, newest first.
 */
export const moderationActionsQueryOptions = queryOptions({
  queryKey: ['admin', 'moderationActions'],
  queryFn: async () => {
    const response = await api.get('/api/v1/admin/moderation-actions', {})
    return response.data.actions
  },
})

/**
 * Invalidates everything the admin views read, so a completed action is
 * reflected in both the user table and the audit feed.
 */
function useRefreshAdminViews() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }
}

/**
 * Promotes or demotes a user. Admins cannot change their own role.
 */
export function useSetUserRole() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: { userId: number; role: UserRole }) => {
      const response = await api.patch('/api/v1/admin/users/:userId/role', {
        params: { userId: input.userId },
        body: { role: input.role },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Bans a user: the account survives but can no longer sign in.
 */
export function useBanUser() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: { userId: number; reason?: string }) => {
      const response = await api.post('/api/v1/moderation/users/:userId/ban', {
        params: { userId: input.userId },
        body: { ...(input.reason ? { reason: input.reason } : {}) },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Lifts a ban.
 */
export function useUnbanUser() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: { userId: number; reason?: string }) => {
      const response = await api.delete('/api/v1/moderation/users/:userId/ban', {
        params: { userId: input.userId },
        body: { ...(input.reason ? { reason: input.reason } : {}) },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Mutes a user for a fixed number of minutes, or permanently when
 * durationMinutes is null.
 */
export function useMuteUser() {
  const refresh = useRefreshAdminViews()

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
    onSuccess: refresh,
  })
}

/**
 * Lifts a mute early.
 */
export function useUnmuteUser() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: { userId: number; reason?: string }) => {
      const response = await api.delete('/api/v1/moderation/users/:userId/mute', {
        params: { userId: input.userId },
        body: { ...(input.reason ? { reason: input.reason } : {}) },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Human-readable summary of one audit entry, e.g.
 * "banned alice" or "changed alice from player to moderator".
 */
export function describeModerationAction(action: {
  action: string
  targetUsername: string | null
  messageChannel: string | null
  details: string | null
}): string {
  const target = action.targetUsername ?? 'a deleted account'

  switch (action.action) {
    case 'message.delete':
      return `deleted a ${action.messageChannel ?? 'chat'} message`
    case 'user.ban':
      return `banned ${target}`
    case 'user.unban':
      return `lifted the ban on ${target}`
    case 'user.mute':
      return `muted ${target}${describeMuteLength(action.details)}`
    case 'user.unmute':
      return `lifted the mute on ${target}`
    case 'user.role':
      return `changed ${target}${describeRoleChange(action.details)}`
    default:
      return `${action.action} on ${target}`
  }
}

/**
 * Reads the mute length back out of an audit entry's details JSON.
 */
function describeMuteLength(details: string | null): string {
  const parsed = parseDetails(details)
  if (parsed === null) {
    return ''
  }
  const minutes = parsed.durationMinutes
  if (minutes === null) {
    return ' permanently'
  }
  const option = MUTE_DURATIONS.find((entry) => entry.minutes === minutes)
  return option ? ` for ${option.label}` : ` for ${String(minutes)} minutes`
}

/**
 * Reads a role change back out of an audit entry's details JSON.
 */
function describeRoleChange(details: string | null): string {
  const parsed = parseDetails(details)
  if (parsed === null || typeof parsed.from !== 'string' || typeof parsed.to !== 'string') {
    return "'s role"
  }
  return ` from ${parsed.from} to ${parsed.to}`
}

/**
 * Parses an audit entry's details column, tolerating null and malformed
 * JSON rather than throwing inside a render.
 */
function parseDetails(
  details: string | null,
): { durationMinutes?: number | null; from?: unknown; to?: unknown } | null {
  if (details === null) {
    return null
  }
  try {
    return JSON.parse(details) as {
      durationMinutes?: number | null
      from?: unknown
      to?: unknown
    }
  } catch {
    return null
  }
}
