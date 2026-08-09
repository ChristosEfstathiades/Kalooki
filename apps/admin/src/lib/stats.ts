import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * Data layer for the competitive-record tools: rebuilding the cached
 * leaderboard, hiding an account from it, and — as the second resort —
 * deleting a player's recorded seats outright.
 */

function useRefreshAdminViews() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }
}

/**
 * Drops the cached leaderboard and recomputes it.
 */
export function useRebuildLeaderboard() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async () => {
      const response = await api.post(
        '/api/v1/admin/stats/leaderboard/rebuild',
        {},
      )
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Hides or restores an account on the global leaderboard, leaving its
 * match history intact.
 */
export function useSetLeaderboardExclusion() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: {
      userId: number
      excluded: boolean
      reason?: string
    }) => {
      const response = await api.patch(
        '/api/v1/admin/stats/users/:userId/exclusion',
        {
          params: { userId: input.userId },
          body: {
            excluded: input.excluded,
            ...(input.reason ? { reason: input.reason } : {}),
          },
        },
      )
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Deletes a player's seats in recorded matches. Irreversible, and it
 * also changes what their opponents see in their own history — the UI
 * asks for the username to be typed before calling this.
 */
export function useWipePlayerStats() {
  const refresh = useRefreshAdminViews()

  return useMutation({
    mutationFn: async (input: {
      userId: number
      includePrivate: boolean
      reason?: string
    }) => {
      const response = await api.delete('/api/v1/admin/stats/users/:userId', {
        params: { userId: input.userId },
        body: {
          includePrivate: input.includePrivate,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}
