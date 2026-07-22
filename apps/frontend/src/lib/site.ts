import { useEffect } from 'react'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#/lib/api'
import { getStoredToken } from '#/lib/auth-token'
import { getSocket } from '#/lib/socket'

/**
 * Admin-controlled site state: the operational switches and the
 * site-wide announcement banner. Read once on load, then kept current
 * by the `site:flags` and `site:announcement` socket events, so a
 * notice or a kill switch reaches players without a refresh.
 */

export interface SiteFlags {
  maintenanceMode: boolean
  signupsEnabled: boolean
  publicMatchmakingEnabled: boolean
  practiceGamesEnabled: boolean
}

export type AnnouncementTone = 'info' | 'warning' | 'critical'

export interface Announcement {
  body: string
  tone: AnnouncementTone
  expiresAt: string | null
  postedAt: string
  postedByUsername: string | null
}

export interface SiteStatus {
  flags: SiteFlags
  announcement: Announcement | null
}

/** Assumed while the request is in flight: everything works. */
const DEFAULT_FLAGS: SiteFlags = {
  maintenanceMode: false,
  signupsEnabled: true,
  publicMatchmakingEnabled: true,
  practiceGamesEnabled: true,
}

const siteStatusQueryKey = ['site', 'status'] as const

export const siteStatusQueryOptions = queryOptions({
  queryKey: siteStatusQueryKey,
  queryFn: async (): Promise<SiteStatus> => {
    const response = await api.get('/api/v1/site', {})
    return {
      flags: response.data.flags,
      announcement: response.data.announcement,
    }
  },
  staleTime: 60 * 1000,
})

/**
 * The current switches, defaulting to "everything on" until the first
 * response arrives so a slow request never hides a working feature.
 */
export function useSiteFlags(): SiteFlags {
  const status = useQuery(siteStatusQueryOptions)
  return status.data?.flags ?? DEFAULT_FLAGS
}

/**
 * The banner to show, or null when nothing is being announced.
 */
export function useAnnouncement(): Announcement | null {
  const status = useQuery(siteStatusQueryOptions)
  return status.data?.announcement ?? null
}

/**
 * Applies live changes an admin makes while the page is open. Mounted
 * once, by the layout that renders the banner.
 */
export function useSiteStatusLiveUpdates(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    // The socket handshake needs a token, so signed-out visitors keep
    // the value they loaded rather than opening a failing connection.
    if (!getStoredToken()) {
      return
    }
    const socket = getSocket()

    const onAnnouncement = (event: { announcement: Announcement | null }) => {
      queryClient.setQueryData<SiteStatus>(siteStatusQueryKey, (old) =>
        old
          ? { ...old, announcement: event.announcement }
          : { flags: DEFAULT_FLAGS, announcement: event.announcement },
      )
    }

    const onFlags = (event: { flags: SiteFlags }) => {
      queryClient.setQueryData<SiteStatus>(siteStatusQueryKey, (old) =>
        old
          ? { ...old, flags: event.flags }
          : { flags: event.flags, announcement: null },
      )
    }

    socket.on('site:announcement', onAnnouncement)
    socket.on('site:flags', onFlags)
    return () => {
      socket.off('site:announcement', onAnnouncement)
      socket.off('site:flags', onFlags)
    }
  }, [queryClient])
}
