import { useQuery } from '@tanstack/react-query'
import { describeModerationAction, moderationActionsQueryOptions } from '#/lib/admin'
import StatusPill from '#/components/StatusPill'
import { formatDateTime } from '#/lib/utils'

/**
 * The moderation audit feed: who did what, to whom, and why. Entries
 * keep the actor and target usernames even after those accounts are
 * deleted (docs/features.md, Roles & Moderation).
 */
export default function ModerationLog() {
  const actions = useQuery(moderationActionsQueryOptions)

  return (
    <section className="flex max-h-[40rem] flex-col rounded-lg border border-edge bg-panel">
      <header className="border-b border-edge px-4 py-3">
        <h2 className="m-0 text-sm font-semibold">Moderation log</h2>
        <p className="m-0 text-xs text-ink-soft">
          Recent moderator and admin actions
        </p>
      </header>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        {actions.isPending && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Loading the log…
          </p>
        )}
        {actions.isSuccess && actions.data.length === 0 && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Nothing has been moderated yet.
          </p>
        )}
        <ul className="m-0 list-none p-0">
          {(actions.data ?? []).map((entry) => (
            <li key={entry.id} className="border-b border-edge px-4 py-3 last:border-b-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{entry.actorUsername}</span>
                <StatusPill
                  label={entry.actorRole}
                  tone={entry.actorRole === 'admin' ? 'accent' : 'neutral'}
                />
                <span className="ml-auto text-xs whitespace-nowrap text-ink-soft">
                  {formatDateTime(entry.createdAt)}
                </span>
              </div>
              <p className="m-0 text-sm text-ink-soft">
                {describeModerationAction(entry)}
              </p>
              {entry.reason !== null && (
                <p className="m-0 text-xs text-ink-soft italic">“{entry.reason}”</p>
              )}
              {entry.messageBody !== null && (
                <p className="m-0 truncate font-mono text-xs text-ink-soft">
                  {entry.messageBody}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
