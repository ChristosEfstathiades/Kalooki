import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

const newsItemSchema = z.object({
  id: z.number(),
  date: z.string(),
  body: z.string(),
})

export type NewsItem = z.infer<typeof newsItemSchema>

/**
 * Query for the site news shown on the play page. The items live in
 * public/news.json (newest first), so announcements can be changed by
 * editing that file — on a deployed server the static file can be
 * swapped without rebuilding the app.
 */
export const newsQueryOptions = queryOptions({
  queryKey: ['news'],
  queryFn: async (): Promise<NewsItem[]> => {
    const response = await fetch('/news.json')
    if (!response.ok) {
      throw new Error(`Could not load news (HTTP ${response.status})`)
    }
    return z.array(newsItemSchema).parse(await response.json())
  },
  staleTime: 5 * 60 * 1000,
})
