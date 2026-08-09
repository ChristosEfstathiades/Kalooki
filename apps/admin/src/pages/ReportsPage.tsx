import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, RotateCcw, Search, Trash2, UserSearch, X } from 'lucide-react'
import {
  REPORT_CHANNELS,
  REPORT_SORTS,
  REPORT_STATUSES,
  reportedAuthorsQueryOptions,
  reportsQueryOptions,
  useDeleteMessage,
  useReopenReport,
  useResolveReport,
} from '#/lib/reports'
import { extractApiErrors } from '#/lib/auth'
import Button from '#/components/Button'
import Pagination from '#/components/Pagination'
import StatusPill from '#/components/StatusPill'
import { Field, Select, TextInput } from '#/components/Field'
import { formatDateTime } from '#/lib/utils'
import type {
  ReportChannel,
  ReportEntry,
  ReportFilters,
  ReportSort,
  ReportStatus,
} from '#/lib/reports'

const DEFAULT_FILTERS: ReportFilters = {
  page: 1,
  status: 'open',
  sort: 'recent',
  channel: 'all',
  search: '',
}

interface ReportsPageProps {
  /** Opens a user's dossier from a report or the offenders list. */
  onInspectUser: (userId: number) => void
}

/**
 * The message report queue. Reports are filed per reporter and reviewed
 * per message, so one decision here closes every open report against
 * the same line.
 */
export default function ReportsPage({ onInspectUser }: ReportsPageProps) {
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS)
  const [searchDraft, setSearchDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reports = useQuery(reportsQueryOptions(filters))
  const authors = useQuery(reportedAuthorsQueryOptions)

  /** Filter changes always return to page one, or paging goes stale. */
  const applyFilters = (changes: Partial<ReportFilters>) => {
    setFilters((current) => ({
      ...current,
      ...changes,
      page: changes.page ?? 1,
    }))
  }

  const entries = reports.data?.reports ?? []
  const meta = reports.data?.meta

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <section className="rounded-lg border border-edge bg-panel">
        <header className="border-b border-edge px-4 py-3">
          <h2 className="m-0 mb-3 text-sm font-semibold">
            Reported messages
            {meta && (
              <span className="ml-2 font-normal text-ink-soft">
                {meta.total}
              </span>
            )}
          </h2>

          <div className="flex flex-wrap items-end gap-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                applyFilters({ search: searchDraft.trim() })
              }}
            >
              <Field label="Search" hideLabel>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-soft"
                  />
                  <TextInput
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Message or author"
                    aria-label="Search reported messages"
                    className="w-52 pl-7"
                  />
                </div>
              </Field>
              <Button size="sm" variant="outline" type="submit">
                Search
              </Button>
            </form>

            <Field label="Status" className="w-28">
              <Select
                value={filters.status}
                onChange={(event) =>
                  applyFilters({ status: event.target.value as ReportStatus })
                }
              >
                {REPORT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Sort" className="w-36">
              <Select
                value={filters.sort}
                onChange={(event) =>
                  applyFilters({ sort: event.target.value as ReportSort })
                }
              >
                {REPORT_SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Channel" className="w-36">
              <Select
                value={filters.channel}
                onChange={(event) =>
                  applyFilters({ channel: event.target.value as ReportChannel })
                }
              >
                {REPORT_CHANNELS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </header>

        {error !== null && (
          <p
            role="alert"
            className="m-0 border-b border-edge px-4 py-2 text-sm"
          >
            {error}
          </p>
        )}

        {reports.isPending && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Loading reports…
          </p>
        )}
        {reports.isSuccess && entries.length === 0 && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            {filters.status === 'open'
              ? 'Nothing is waiting for review.'
              : 'No reports match this filter.'}
          </p>
        )}

        <ul className="m-0 list-none p-0">
          {entries.map((entry) => (
            <ReportRow
              key={entry.messageId}
              entry={entry}
              onError={setError}
              onInspectUser={onInspectUser}
            />
          ))}
        </ul>

        {meta && (
          <Pagination
            page={meta.page}
            lastPage={meta.lastPage}
            total={meta.total}
            noun="reported messages"
            onChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        )}
      </section>

      <section className="rounded-lg border border-edge bg-panel">
        <header className="border-b border-edge px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Most reported authors</h2>
          <p className="m-0 text-xs text-ink-soft">
            A persistent offender stands out here; one ugly message does not
          </p>
        </header>

        {authors.isPending && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Loading…
          </p>
        )}
        {authors.isSuccess && authors.data.length === 0 && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Nobody has been reported yet.
          </p>
        )}

        <ul className="m-0 list-none p-0">
          {(authors.data ?? []).map((author) => (
            <li
              key={author.userId}
              className="flex items-baseline gap-2 border-b border-edge px-4 py-2 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onInspectUser(author.userId)}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                {author.username}
              </button>
              {author.isBanned && <StatusPill label="Banned" tone="danger" />}
              {author.isMuted && <StatusPill label="Muted" tone="warn" />}
              <span className="ml-auto text-xs whitespace-nowrap text-ink-soft tabular-nums">
                {author.totalReports} on {author.reportedMessages} msg
                {author.openReports > 0 && ` · ${author.openReports} open`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

interface ReportRowProps {
  entry: ReportEntry
  onError: (message: string | null) => void
  onInspectUser: (userId: number) => void
}

/** How a channel is named in the queue. */
const CHANNEL_LABELS: Record<string, string> = {
  global: 'Global chat',
  match: 'In-game chat',
  group: 'Group chat',
}

/**
 * One reported message: the line itself, who wrote it, who reported it,
 * and the decisions available. Group messages can be dismissed but
 * never deleted, because moderation does not reach into a group's chat.
 */
function ReportRow({ entry, onError, onInspectUser }: ReportRowProps) {
  const [note, setNote] = useState('')
  const [showReporters, setShowReporters] = useState(false)

  const resolve = useResolveReport()
  const reopen = useReopenReport()
  const deleteMessage = useDeleteMessage()

  const busy = resolve.isPending || reopen.isPending || deleteMessage.isPending
  const canDelete = entry.channel !== 'group' && entry.deletedAt === null

  const run = async (action: () => Promise<unknown>) => {
    onError(null)
    try {
      await action()
      setNote('')
    } catch (caught) {
      onError(extractApiErrors(caught)[0])
    }
  }

  return (
    <li className="border-b border-edge px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        {entry.author ? (
          <button
            type="button"
            onClick={() => onInspectUser(entry.author?.id ?? 0)}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {entry.author.username}
          </button>
        ) : (
          <span className="text-sm font-medium text-ink-soft">
            a deleted account
          </span>
        )}
        {entry.author?.isBanned && <StatusPill label="Banned" tone="danger" />}
        {entry.author?.isMuted && <StatusPill label="Muted" tone="warn" />}
        <StatusPill label={CHANNEL_LABELS[entry.channel] ?? entry.channel} />
        {entry.wasCensored && <StatusPill label="Censored" tone="warn" />}
        {entry.deletedAt !== null && (
          <StatusPill label="Deleted" tone="danger" />
        )}
        {entry.isResolved ? (
          <StatusPill label="Resolved" tone="ok" />
        ) : (
          <StatusPill label={`${entry.openCount} open`} tone="warn" />
        )}
        <span className="ml-auto text-xs whitespace-nowrap text-ink-soft">
          {formatDateTime(entry.postedAt)}
        </span>
      </div>

      <p className="my-1 font-mono text-sm break-words">{entry.body}</p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <button
          type="button"
          onClick={() => setShowReporters((open) => !open)}
          className="underline underline-offset-4 hover:text-ink"
        >
          {entry.reportCount} {entry.reportCount === 1 ? 'report' : 'reports'}
        </button>
        <span>last {formatDateTime(entry.lastReportedAt)}</span>
        {entry.author && (
          <button
            type="button"
            onClick={() => onInspectUser(entry.author?.id ?? 0)}
            className="ml-auto inline-flex items-center gap-1 underline underline-offset-4 hover:text-ink"
          >
            <UserSearch aria-hidden="true" className="size-3" />
            Open dossier
          </button>
        )}
      </div>

      {showReporters && (
        <ul className="m-0 mt-1 list-none border-l border-edge pl-3 text-xs text-ink-soft">
          {entry.reports.map((report) => (
            <li key={report.id}>
              {report.reporterUsername ?? 'a deleted account'} ·{' '}
              {formatDateTime(report.createdAt)}
              {report.outcome !== null &&
                ` · ${report.outcome} by ${report.resolvedByUsername ?? 'an admin'}`}
              {report.resolutionNote !== null &&
                ` — “${report.resolutionNote}”`}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {!entry.isResolved && (
          <TextInput
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note (optional)"
            aria-label={`Resolution note for message ${entry.messageId}`}
            className="w-48"
          />
        )}

        {canDelete && (
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await deleteMessage.mutateAsync({
                  messageId: entry.messageId,
                  reason: note || undefined,
                })
                await resolve.mutateAsync({
                  messageId: entry.messageId,
                  outcome: 'actioned',
                  note: note || undefined,
                })
              })
            }
          >
            <Trash2 aria-hidden="true" />
            Delete & action
          </Button>
        )}

        {!entry.isResolved && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  resolve.mutateAsync({
                    messageId: entry.messageId,
                    outcome: 'actioned',
                    note: note || undefined,
                  }),
                )
              }
            >
              <Check aria-hidden="true" />
              Mark actioned
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  resolve.mutateAsync({
                    messageId: entry.messageId,
                    outcome: 'dismissed',
                    note: note || undefined,
                  }),
                )
              }
            >
              <X aria-hidden="true" />
              Dismiss
            </Button>
          </>
        )}

        {entry.isResolved && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void run(() => reopen.mutateAsync(entry.messageId))}
          >
            <RotateCcw aria-hidden="true" />
            Reopen
          </Button>
        )}
      </div>
    </li>
  )
}
