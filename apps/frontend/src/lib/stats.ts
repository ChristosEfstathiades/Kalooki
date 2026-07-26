import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * The signed-in player's own competitive record. Kept apart from the
 * leaderboard query: that one is the same board for everybody and is
 * cached as such, while this is personal and changes as soon as the
 * player finishes a match.
 */
export const playerRecordQueryOptions = queryOptions({
  queryKey: ['record'],
  queryFn: async () => {
    const response = await api.get('/api/v1/record', {})
    return response.data.record
  },
})

/**
 * 0.6 -> "60%", 0.3333 -> "33.3%".
 */
export function formatPercent(rate: number): string {
  const percent = rate * 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}
