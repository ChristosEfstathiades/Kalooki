import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
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
export const MUTE_DURATIONS: Array<{ label: string; minutes: number | null }> =
  [
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
 * The full dossier for one account: play record, recent chat, the
 * reports for and against them, and their moderation history.
 */
async function fetchUserDossier(userId: number) {
  const response = await api.get('/api/v1/admin/users/:userId', {
    params: { userId },
  })
  return response.data
}

export type UserDossier = Awaited<ReturnType<typeof fetchUserDossier>>

export function userDossierQueryOptions(userId: number) {
  return queryOptions({
    queryKey: ['admin', 'users', 'dossier', userId],
    queryFn: () => fetchUserDossier(userId),
  })
}

/** Action types the audit log can be filtered down to. */
export const MODERATION_ACTION_FILTERS = [
  'message.delete',
  'user.ban',
  'user.unban',
  'user.mute',
  'user.unmute',
  'user.role',
  'report.resolve',
  'news.create',
  'news.update',
  'news.delete',
  'site.flags',
  'site.announce',
  'site.announce.clear',
  'stats.reset',
] as const

export type ModerationActionFilter = (typeof MODERATION_ACTION_FILTERS)[number]

export interface AuditFilters {
  page: number
  action: ModerationActionFilter | 'all'
  actor: string
  target: string
  from: string
  to: string
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  page: 1,
  action: 'all',
  actor: '',
  target: '',
  from: '',
  to: '',
}

/**
 * Turns a date input's `YYYY-MM-DD` value into an ISO timestamp, or
 * undefined when the field is empty.
 */
function isoBound(value: string): string | undefined {
  if (value === '') {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

/**
 * The moderation audit trail, newest first, for the given filters.
 */
export function moderationActionsQueryOptions(
  filters: AuditFilters = EMPTY_AUDIT_FILTERS,
) {
  const from = isoBound(filters.from)
  const to = isoBound(filters.to)

  return queryOptions({
    queryKey: ['admin', 'moderationActions', filters],
    queryFn: async () => {
      const response = await api.get('/api/v1/admin/moderation-actions', {
        query: {
          page: filters.page,
          ...(filters.action !== 'all' ? { action: filters.action } : {}),
          ...(filters.actor ? { actor: filters.actor } : {}),
          ...(filters.target ? { target: filters.target } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      })
      return response.data
    },
  })
}

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
      const response = await api.delete(
        '/api/v1/moderation/users/:userId/ban',
        {
          params: { userId: input.userId },
          body: { ...(input.reason ? { reason: input.reason } : {}) },
        },
      )
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
      const response = await api.delete(
        '/api/v1/moderation/users/:userId/mute',
        {
          params: { userId: input.userId },
          body: { ...(input.reason ? { reason: input.reason } : {}) },
        },
      )
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
    case 'report.resolve':
      return `resolved the reports on a ${action.messageChannel ?? 'chat'} message${describeReportOutcome(action.details)}`
    case 'news.create':
      return 'published a news item'
    case 'news.update':
      return 'edited a news item'
    case 'news.delete':
      return 'deleted a news item'
    case 'site.flags':
      return 'changed the site settings'
    case 'site.announce':
      return 'posted a site announcement'
    case 'site.announce.clear':
      return 'cleared the site announcement'
    case 'stats.reset':
      return `${describeStatsAction(action.details)} ${target}`
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
 * Reads a report resolution's outcome back out of an audit entry.
 */
function describeReportOutcome(details: string | null): string {
  const parsed = parseDetails(details)
  if (parsed === null || typeof parsed.outcome !== 'string') {
    return ''
  }
  return parsed.outcome === 'dismissed'
    ? ' as no action needed'
    : ' as actioned'
}

/**
 * Distinguishes the two stats actions, which share one audit name.
 */
function describeStatsAction(details: string | null): string {
  const parsed = parseDetails(details)
  if (parsed === null || parsed.kind !== 'leaderboard-exclusion') {
    return 'wiped the recorded stats of'
  }
  return parsed.excluded === true
    ? 'excluded from the leaderboard:'
    : 'restored to the leaderboard:'
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
  if (
    parsed === null ||
    typeof parsed.from !== 'string' ||
    typeof parsed.to !== 'string'
  ) {
    return "'s role"
  }
  return ` from ${parsed.from} to ${parsed.to}`
}

/**
 * Parses an audit entry's details column, tolerating null and malformed
 * JSON rather than throwing inside a render.
 */
function parseDetails(details: string | null): AuditDetails | null {
  if (details === null) {
    return null
  }
  try {
    return JSON.parse(details) as AuditDetails
  } catch {
    return null
  }
}

/** The keys the audit entries' details JSON is read for. */
interface AuditDetails {
  durationMinutes?: number | null
  from?: unknown
  to?: unknown
  outcome?: unknown
  kind?: unknown
  excluded?: unknown
}
