import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * Data layer for the operational switches and the site-wide
 * announcement banner. Both take effect for connected players
 * immediately, over the socket, so nothing here needs a deploy.
 */

export type AnnouncementTone = 'info' | 'warning' | 'critical'

export const ANNOUNCEMENT_TONES: Array<{
  value: AnnouncementTone
  label: string
}> = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
]

/** Banner lifetimes offered in the UI. Null stays up until cleared. */
export const ANNOUNCEMENT_DURATIONS: Array<{
  label: string
  minutes: number | null
}> = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 60 * 6 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: 'Until I clear it', minutes: null },
]

async function fetchSettings() {
  const response = await api.get('/api/v1/admin/settings', {})
  return response.data
}

export type AdminSettings = Awaited<ReturnType<typeof fetchSettings>>
export type SiteFlags = AdminSettings['flags']

export const settingsQueryOptions = queryOptions({
  queryKey: ['admin', 'settings'],
  queryFn: fetchSettings,
})

function useRefreshSettings() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }
}

/**
 * Flips one or more operational switches.
 */
export function useUpdateSiteFlags() {
  const refresh = useRefreshSettings()

  return useMutation({
    mutationFn: async (changes: Partial<SiteFlags>) => {
      const response = await api.patch('/api/v1/admin/settings/flags', {
        body: changes,
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Raises the site-wide banner, optionally posting the same text into
 * the global chatroom.
 */
export function usePublishAnnouncement() {
  const refresh = useRefreshSettings()

  return useMutation({
    mutationFn: async (input: {
      body: string
      tone: AnnouncementTone
      durationMinutes: number | null
      alsoPostToChat: boolean
    }) => {
      const response = await api.post('/api/v1/admin/settings/announcement', {
        body: {
          body: input.body,
          tone: input.tone,
          durationMinutes: input.durationMinutes,
          alsoPostToChat: input.alsoPostToChat,
        },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Takes the banner down for everyone.
 */
export function useClearAnnouncement() {
  const refresh = useRefreshSettings()

  return useMutation({
    mutationFn: async () => {
      const response = await api.delete(
        '/api/v1/admin/settings/announcement',
        {},
      )
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Posts a one-off line into the global chatroom without raising the
 * banner. Live only, so it is never stored or reportable.
 */
export function usePostGlobalNotice() {
  return useMutation({
    mutationFn: async (body: string) => {
      const response = await api.post('/api/v1/admin/settings/notice', {
        body: { body },
      })
      return response.data
    },
  })
}
