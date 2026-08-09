import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * Data layer for the overview page's figures. Refetched on a timer
 * because the live section (players online, games in progress) is a
 * snapshot of the running server rather than stored state.
 */

/** How often the dashboard refreshes itself while it is open. */
const REFRESH_INTERVAL_MS = 30 * 1000

async function fetchMetrics() {
  const response = await api.get('/api/v1/admin/metrics', {})
  return response.data
}

export type AdminMetrics = Awaited<ReturnType<typeof fetchMetrics>>
export type TrendPoint = AdminMetrics['trend'][number]

export const metricsQueryOptions = queryOptions({
  queryKey: ['admin', 'metrics'],
  queryFn: fetchMetrics,
  refetchInterval: REFRESH_INTERVAL_MS,
})
