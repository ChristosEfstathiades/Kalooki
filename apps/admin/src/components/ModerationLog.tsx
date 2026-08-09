import { useQuery } from '@tanstack/react-query'
import { moderationActionsQueryOptions } from '#/lib/admin'
import ModerationEntry from '#/components/ModerationEntry'
import { sectionHref } from '#/lib/router'

/**
 * The moderation audit feed on the overview: the most recent moderator
 * and admin actions, unfiltered. The audit log section is the same
 * trail with filters and paging over it.
 */
export default function ModerationLog() {
  const actions = useQuery(moderationActionsQueryOptions())
  const entries = actions.data?.actions ?? []

  return (
    <section className="flex max-h-[40rem] flex-col rounded-lg border border-edge bg-panel">
      <header className="flex items-baseline gap-2 border-b border-edge px-4 py-3">
        <div className="mr-auto">
          <h2 className="m-0 text-sm font-semibold">Moderation log</h2>
          <p className="m-0 text-xs text-ink-soft">
            Recent moderator and admin actions
          </p>
        </div>
        <a
          href={sectionHref('audit')}
          className="text-xs text-ink-soft underline underline-offset-4 hover:text-ink"
        >
          View all
        </a>
      </header>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        {actions.isPending && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Loading the log…
          </p>
        )}
        {actions.isSuccess && entries.length === 0 && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Nothing has been moderated yet.
          </p>
        )}
        <ul className="m-0 list-none p-0">
          {entries.map((entry) => (
            <ModerationEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      </div>
    </section>
  )
}
