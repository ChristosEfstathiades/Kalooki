import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import { newsQueryOptions } from '#/lib/news'

/**
 * News panel shown below the chat sidebar on the play page, for site
 * announcements and update notes. Items come from public/news.json
 * (see #/lib/news).
 */
export default function NewsCard() {
  const news = useQuery(newsQueryOptions)
  const items = news.data ?? []

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Newspaper aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="m-0 text-sm font-semibold">News</h2>
      </div>
      {items.length > 0 ? (
        <ul className="m-0 list-none space-y-3 px-4 py-3">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <p className="m-0 text-xs text-muted-foreground">{item.date}</p>
              <p className="m-0 mt-0.5">{item.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 px-4 py-3 text-sm text-muted-foreground">
          {news.isError ? 'Could not load the news.' : 'No news right now.'}
        </p>
      )}
    </section>
  )
}
