import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * Data layer for the message report queue. Reports are filed one per
 * reporter but reviewed per message, so everything here is keyed by
 * message id rather than report id.
 */

export type ReportStatus = 'open' | 'resolved' | 'all'
export type ReportSort = 'recent' | 'oldest' | 'most-reported'
export type ReportChannel = 'global' | 'group' | 'match' | 'all'
export type ReportOutcome = 'actioned' | 'dismissed'

export const REPORT_SORTS: Array<{ value: ReportSort; label: string }> = [
  { value: 'recent', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most-reported', label: 'Most reported' },
]

export const REPORT_STATUSES: Array<{ value: ReportStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

export const REPORT_CHANNELS: Array<{ value: ReportChannel; label: string }> = [
  { value: 'all', label: 'All channels' },
  { value: 'global', label: 'Global chat' },
  { value: 'match', label: 'In-game chat' },
  { value: 'group', label: 'Group chat' },
]

export interface ReportFilters {
  page: number
  status: ReportStatus
  sort: ReportSort
  channel: ReportChannel
  search: string
}

/**
 * Fetches one page of the queue. Named rather than inlined so the row
 * type can be inferred from it: the queue's shapes are computed
 * aggregates, not model transformers, so they are not in the generated
 * `Data` namespace and have to flow from the response instead.
 */
async function fetchReports(filters: ReportFilters) {
  const response = await api.get('/api/v1/admin/reports', {
    query: {
      page: filters.page,
      status: filters.status,
      sort: filters.sort,
      channel: filters.channel,
      ...(filters.search ? { search: filters.search } : {}),
    },
  })
  return response.data
}

export type ReportEntry = Awaited<
  ReturnType<typeof fetchReports>
>['reports'][number]

/**
 * One page of the queue for the current filters.
 */
export function reportsQueryOptions(filters: ReportFilters) {
  return queryOptions({
    queryKey: ['admin', 'reports', filters],
    queryFn: () => fetchReports(filters),
  })
}

/**
 * Authors whose messages draw the most reports, worst first.
 */
async function fetchReportedAuthors() {
  const response = await api.get('/api/v1/admin/reports/authors', {})
  return response.data.authors
}

export type ReportedAuthor = Awaited<
  ReturnType<typeof fetchReportedAuthors>
>[number]

export const reportedAuthorsQueryOptions = queryOptions({
  queryKey: ['admin', 'reports', 'authors'],
  queryFn: fetchReportedAuthors,
})

/**
 * How many messages still have an unresolved report, for the queue's
 * badge in the sidebar.
 */
export const openReportCountQueryOptions = queryOptions({
  queryKey: ['admin', 'reports', 'open-count'],
  queryFn: async () => {
    const response = await api.get('/api/v1/admin/reports/open-count', {})
    return response.data.openReports
  },
  refetchInterval: 60 * 1000,
})

/**
 * Invalidates everything the admin views read, so an action shows in
 * the queue, the user table and the audit feed at once.
 */
function useRefreshAdminViews() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }
}

/**
 * Closes every open report against a message, recording whether it was
 * actioned or dismissed.
 */
export function useResolveReport() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: {
      messageId: number
      outcome: ReportOutcome
      note?: string
    }) => {
      const response = await api.post(
        '/api/v1/admin/reports/messages/:messageId/resolve',
        {
          params: { messageId: input.messageId },
          body: {
            outcome: input.outcome,
            ...(input.note ? { note: input.note } : {}),
          },
        },
      )
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Reopens a message's reports when a resolution was the wrong call.
 */
export function useReopenReport() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (messageId: number) => {
      const response = await api.delete(
        '/api/v1/admin/reports/messages/:messageId/resolve',
        {
          params: { messageId },
        },
      )
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Deletes a reported message from the chat it was posted in. Shares the
 * moderator endpoint the player site's inline controls use.
 */
export function useDeleteMessage() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: { messageId: number; reason?: string }) => {
      const response = await api.delete('/api/v1/moderation/messages/:id', {
        params: { id: input.messageId },
        body: { ...(input.reason ? { reason: input.reason } : {}) },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}
