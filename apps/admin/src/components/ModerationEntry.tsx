import { describeModerationAction } from '#/lib/admin'
import StatusPill from '#/components/StatusPill'
import { formatDateTime } from '#/lib/utils'

/** One row of the audit trail, as both the feed and the log page show it. */
export interface ModerationEntryData {
  id: number
  action: string
  actorUsername: string
  actorRole: string
  targetUsername: string | null
  messageChannel: string | null
  messageBody: string | null
  reason: string | null
  details: string | null
  createdAt: string | null
}

interface ModerationEntryProps {
  entry: ModerationEntryData
}

/**
 * One audit entry: who did what, to whom, and why. Usernames come from
 * the snapshot columns, so an entry stays readable after the account it
 * names has been deleted.
 */
export default function ModerationEntry({ entry }: ModerationEntryProps) {
  return (
    <li className="border-b border-edge px-4 py-3 last:border-b-0">
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
  )
}
