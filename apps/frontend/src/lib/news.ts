import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api'

export interface NewsItem {
  id: number
  /** Pre-formatted publication date, shown verbatim in the panel. */
  date: string
  body: string
  isPinned: boolean
}

/**
 * Query for the site news shown on the play page. Items are written by
 * admins on admin.{domain} and served from the backend, so a notice
 * goes up without a redeploy. Pinned items come first, then newest by
 * publication date.
 */
export const newsQueryOptions = queryOptions({
  queryKey: ['news'],
  queryFn: async (): Promise<NewsItem[]> => {
    const response = await api.get('/api/v1/site/news', {})
    return response.data.news
  },
  staleTime: 5 * 60 * 1000,
})
