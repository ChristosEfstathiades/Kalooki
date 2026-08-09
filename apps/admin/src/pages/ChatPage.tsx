import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Trash2 } from 'lucide-react'
import {
  CHAT_CHANNELS,
  EMPTY_CHAT_FILTERS,
  chatMessagesQueryOptions,
} from '#/lib/chat-browser'
import { useDeleteMessage } from '#/lib/reports'
import { extractApiErrors } from '#/lib/auth'
import Button from '#/components/Button'
import Pagination from '#/components/Pagination'
import StatusPill from '#/components/StatusPill'
import { Checkbox, Field, Select, TextInput } from '#/components/Field'
import { formatDateTime } from '#/lib/utils'
import type { ChatChannelFilter, ChatSearchFilters } from '#/lib/chat-browser'

interface ChatPageProps {
  onInspectUser: (userId: number) => void
}

/**
 * The chat browser: search the global chatroom and live game chats when
 * investigating a user, rather than seeing only the one line that got
 * reported. Private group chats are absent by design — moderation never
 * reaches into a group's conversation, so it is not searchable either.
 */
export default function ChatPage({ onInspectUser }: ChatPageProps) {
  const [filters, setFilters] = useState<ChatSearchFilters>(EMPTY_CHAT_FILTERS)
  const [draft, setDraft] = useState<ChatSearchFilters>(EMPTY_CHAT_FILTERS)
  const [error, setError] = useState<string | null>(null)

  const messages = useQuery(chatMessagesQueryOptions(filters))
  const deleteMessage = useDeleteMessage()

  const rows = messages.data?.messages ?? []
  const meta = messages.data?.meta

  const removeMessage = async (messageId: number) => {
    setError(null)
    try {
      await deleteMessage.mutateAsync({ messageId })
    } catch (caught) {
      setError(extractApiErrors(caught)[0])
    }
  }

  return (
    <section className="rounded-lg border border-edge bg-panel">
      <header className="border-b border-edge px-4 py-3">
        <h2 className="m-0 text-sm font-semibold">
          Chat browser
          {meta && (
            <span className="ml-2 font-normal text-ink-soft">{meta.total}</span>
          )}
        </h2>
        <p className="m-0 mb-3 text-xs text-ink-soft">
          The global chatroom and live game chats. Private group chats are not
          searchable.
        </p>

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            setFilters({ ...draft, page: 1 })
          }}
        >
          <Field label="Contains" className="w-56">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-soft"
              />
              <TextInput
                value={draft.search}
                onChange={(event) =>
                  setDraft({ ...draft, search: event.target.value })
                }
                placeholder="Message text"
                className="pl-7"
              />
            </div>
          </Field>

          <Field label="Author" className="w-40">
            <TextInput
              value={draft.username}
              onChange={(event) =>
                setDraft({ ...draft, username: event.target.value })
              }
              placeholder="Exact username"
            />
          </Field>

          <Field label="Channel" className="w-36">
            <Select
              value={draft.channel}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  channel: event.target.value as ChatChannelFilter,
                })
              }
            >
              {CHAT_CHANNELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
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

          <div className="flex flex-col gap-1 pb-1">
            <Checkbox
              label="Include deleted"
              checked={draft.includeDeleted}
              onChange={(event) =>
                setDraft({ ...draft, includeDeleted: event.target.checked })
              }
            />
            <Checkbox
              label="Censored only"
              checked={draft.censoredOnly}
              onChange={(event) =>
                setDraft({ ...draft, censoredOnly: event.target.checked })
              }
            />
            <Checkbox
              label="Reported only"
              checked={draft.reportedOnly}
              onChange={(event) =>
                setDraft({ ...draft, reportedOnly: event.target.checked })
              }
            />
          </div>

          <div className="flex gap-2 pb-1">
            <Button size="sm" type="submit">
              Search
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => {
                setDraft(EMPTY_CHAT_FILTERS)
                setFilters(EMPTY_CHAT_FILTERS)
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </header>

      {error !== null && (
        <p role="alert" className="m-0 border-b border-edge px-4 py-2 text-sm">
          {error}
        </p>
      )}

      {messages.isPending && (
        <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
          Loading messages…
        </p>
      )}
      {messages.isSuccess && rows.length === 0 && (
        <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
          No messages match this search.
        </p>
      )}

      <ul className="m-0 list-none p-0">
        {rows.map((message) => (
          <li
            key={message.id}
            className="flex flex-wrap items-baseline gap-x-2 border-b border-edge px-4 py-2 last:border-b-0"
          >
            {message.author ? (
              <button
                type="button"
                onClick={() => onInspectUser(message.author?.id ?? 0)}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                {message.author.username}
              </button>
            ) : (
              <span className="text-sm text-ink-soft">a deleted account</span>
            )}
            <StatusPill
              label={message.channel === 'match' ? 'In-game' : 'Global'}
            />
            {message.wasCensored && <StatusPill label="Censored" tone="warn" />}
            {message.reportCount > 0 && (
              <StatusPill
                label={`${message.reportCount} ${message.reportCount === 1 ? 'report' : 'reports'}`}
                tone="warn"
              />
            )}
            {message.deletedAt !== null && (
              <StatusPill label="Deleted" tone="danger" />
            )}

            <span className="ml-auto flex items-center gap-2 text-xs whitespace-nowrap text-ink-soft">
              {formatDateTime(message.createdAt)}
              {message.deletedAt === null && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleteMessage.isPending}
                  onClick={() => void removeMessage(message.id)}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
              )}
            </span>

            <p className="m-0 w-full font-mono text-sm break-words">
              {message.body}
            </p>
          </li>
        ))}
      </ul>

      {meta && (
        <Pagination
          page={meta.page}
          lastPage={meta.lastPage}
          total={meta.total}
          noun="messages"
          onChange={(page) => setFilters((current) => ({ ...current, page }))}
        />
      )}
    </section>
  )
}
