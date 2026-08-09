import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '#/lib/api'

/**
 * Data layer for the news panel shown on the play page. Admins see
 * drafts as well as published items; players only ever see the latter.
 */

async function fetchNews() {
  const response = await api.get('/api/v1/admin/news', {})
  return response.data.news
}

export type AdminNewsItem = Awaited<ReturnType<typeof fetchNews>>[number]

export const newsQueryOptions = queryOptions({
  queryKey: ['admin', 'news'],
  queryFn: fetchNews,
})

export interface NewsDraft {
  body: string
  /** `YYYY-MM-DD` from the date input; empty means "now". */
  publishedAt: string
  isPublished: boolean
  isPinned: boolean
}

/**
 * Turns the form's date value into the ISO timestamp the API expects,
 * or undefined so the server dates the item itself.
 */
function isoPublishedAt(value: string): string | undefined {
  if (value === '') {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function useRefreshNews() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] })
  }
}

/**
 * Publishes a new item, or saves it as a draft.
 */
export function useCreateNewsItem() {
  const refresh = useRefreshNews()

  return useMutation({
    mutationFn: async (draft: NewsDraft) => {
      const publishedAt = isoPublishedAt(draft.publishedAt)
      const response = await api.post('/api/v1/admin/news', {
        body: {
          body: draft.body,
          isPublished: draft.isPublished,
          isPinned: draft.isPinned,
          ...(publishedAt ? { publishedAt } : {}),
        },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Edits an item. Only the supplied fields change, so the list can
 * toggle "pinned" or "published" without resending the body.
 */
export function useUpdateNewsItem() {
  const refresh = useRefreshNews()

  return useMutation({
    mutationFn: async (input: { id: number; changes: Partial<NewsDraft> }) => {
      const { changes } = input
      const publishedAt =
        changes.publishedAt === undefined
          ? undefined
          : isoPublishedAt(changes.publishedAt)

      const response = await api.patch('/api/v1/admin/news/:id', {
        params: { id: input.id },
        body: {
          ...(changes.body !== undefined ? { body: changes.body } : {}),
          ...(changes.isPublished !== undefined
            ? { isPublished: changes.isPublished }
            : {}),
          ...(changes.isPinned !== undefined
            ? { isPinned: changes.isPinned }
            : {}),
          ...(publishedAt ? { publishedAt } : {}),
        },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}

/**
 * Removes an item outright. The audit trail keeps its body.
 */
export function useDeleteNewsItem() {
  const refresh = useRefreshNews()

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete('/api/v1/admin/news/:id', {
        params: { id },
      })
      return response.data
    },
    onSuccess: refresh,
  })
}
