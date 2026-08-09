import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  EMPTY_AUDIT_FILTERS,
  MODERATION_ACTION_FILTERS,
  moderationActionsQueryOptions,
} from '#/lib/admin'
import Button from '#/components/Button'
import ModerationEntry from '#/components/ModerationEntry'
import Pagination from '#/components/Pagination'
import { Field, Select, TextInput } from '#/components/Field'
import type { AuditFilters, ModerationActionFilter } from '#/lib/admin'

/**
 * The full moderation audit trail with filters over it. Every moderator
 * and admin action lands here — deletions, bans, mutes, role changes,
 * report decisions, news edits and settings changes — so the site's
 * whole administration is accountable in one place.
 */
export default function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS)
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS)

  const actions = useQuery(moderationActionsQueryOptions(filters))
  const entries = actions.data?.actions ?? []
  const meta = actions.data?.meta

  return (
    <section className="rounded-lg border border-edge bg-panel">
      <header className="border-b border-edge px-4 py-3">
        <h2 className="m-0 text-sm font-semibold">
          Audit log
          {meta && (
            <span className="ml-2 font-normal text-ink-soft">{meta.total}</span>
          )}
        </h2>
        <p className="m-0 mb-3 text-xs text-ink-soft">
          Every moderator and admin action, newest first
        </p>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            setFilters({ ...draft, page: 1 })
          }}
        >
          <Field label="Action" className="w-48">
            <Select
              value={draft.action}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  action: event.target.value as ModerationActionFilter | 'all',
                })
              }
            >
              <option value="all">All actions</option>
              {MODERATION_ACTION_FILTERS.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Actor" className="w-40">
            <TextInput
              value={draft.actor}
              onChange={(event) =>
                setDraft({ ...draft, actor: event.target.value })
              }
              placeholder="Who acted"
            />
          </Field>

          <Field label="Target" className="w-40">
            <TextInput
              value={draft.target}
              onChange={(event) =>
                setDraft({ ...draft, target: event.target.value })
              }
              placeholder="Who was acted on"
            />
          </Field>

          <Field label="From" className="w-36">
            <TextInput
              type="date"
              value={draft.from}
              onChange={(event) =>
                setDraft({ ...draft, from: event.target.value })
              }
            />
          </Field>

          <Field label="To" className="w-36">
            <TextInput
              type="date"
              value={draft.to}
              onChange={(event) =>
                setDraft({ ...draft, to: event.target.value })
              }
            />
          </Field>

          <div className="flex gap-2 pb-1">
            <Button size="sm" type="submit">
              Filter
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setDraft(EMPTY_AUDIT_FILTERS)
                setFilters(EMPTY_AUDIT_FILTERS)
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </header>

      {actions.isPending && (
        <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
          Loading the log…
        </p>
      )}
      {actions.isSuccess && entries.length === 0 && (
        <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
          No actions match this filter.
        </p>
      )}

      <ul className="m-0 list-none p-0">
        {entries.map((entry) => (
          <ModerationEntry key={entry.id} entry={entry} />
        ))}
      </ul>

      {meta && (
        <Pagination
          page={meta.page}
          lastPage={meta.lastPage}
          total={meta.total}
          noun="entries"
          onChange={(page) => setFilters((current) => ({ ...current, page }))}
        />
      )}
    </section>
  )
}
