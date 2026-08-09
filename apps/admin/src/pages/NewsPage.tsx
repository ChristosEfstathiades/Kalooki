import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import {
  newsQueryOptions,
  useCreateNewsItem,
  useDeleteNewsItem,
  useUpdateNewsItem,
} from '#/lib/news'
import { extractApiErrors } from '#/lib/auth'
import Button from '#/components/Button'
import StatusPill from '#/components/StatusPill'
import { Checkbox, Field, TextArea, TextInput } from '#/components/Field'
import { formatDateTime } from '#/lib/utils'
import type { AdminNewsItem, NewsDraft } from '#/lib/news'

const EMPTY_DRAFT: NewsDraft = {
  body: '',
  publishedAt: '',
  isPublished: true,
  isPinned: false,
}

/** Longest body the backend accepts, mirrored so the UI can count down. */
const MAX_BODY_LENGTH = 1000

/**
 * Editing the news panel on the play page. Items live in the database
 * rather than a static file, so publishing a notice takes effect for
 * players immediately.
 */
export default function NewsPage() {
  const [draft, setDraft] = useState<NewsDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  const news = useQuery(newsQueryOptions)
  const createItem = useCreateNewsItem()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await createItem.mutateAsync(draft)
      setDraft(EMPTY_DRAFT)
    } catch (caught) {
      setError(extractApiErrors(caught)[0])
    }
  }

  const items = news.data ?? []

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <section className="rounded-lg border border-edge bg-panel">
        <header className="border-b border-edge px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Post an update</h2>
          <p className="m-0 text-xs text-ink-soft">
            Shown in the news panel beside the chat on the play page
          </p>
        </header>

        <form
          className="space-y-3 p-4"
          onSubmit={(event) => void submit(event)}
        >
          {error !== null && (
            <p role="alert" className="m-0 text-sm">
              {error}
            </p>
          )}

          <Field
            label="Body"
            hint={`${draft.body.length} / ${MAX_BODY_LENGTH} characters`}
          >
            <TextArea
              value={draft.body}
              maxLength={MAX_BODY_LENGTH}
              required
              onChange={(event) =>
                setDraft({ ...draft, body: event.target.value })
              }
              placeholder="What has changed, or what is coming up?"
            />
          </Field>

          <Field label="Date" hint="Leave empty to date it now">
            <TextInput
              type="date"
              value={draft.publishedAt}
              onChange={(event) =>
                setDraft({ ...draft, publishedAt: event.target.value })
              }
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Checkbox
              label="Publish immediately"
              checked={draft.isPublished}
              onChange={(event) =>
                setDraft({ ...draft, isPublished: event.target.checked })
              }
            />
            <Checkbox
              label="Pin above other items"
              checked={draft.isPinned}
              onChange={(event) =>
                setDraft({ ...draft, isPinned: event.target.checked })
              }
            />
          </div>

          <Button
            type="submit"
            disabled={createItem.isPending || draft.body.trim() === ''}
          >
            <Plus aria-hidden="true" />
            {createItem.isPending ? 'Saving…' : 'Post update'}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-edge bg-panel">
        <header className="border-b border-edge px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">
            News items
            <span className="ml-2 font-normal text-ink-soft">
              {items.length}
            </span>
          </h2>
          <p className="m-0 text-xs text-ink-soft">
            Pinned first, then newest. Players see published items only.
          </p>
        </header>

        {news.isPending && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Loading…
          </p>
        )}
        {news.isSuccess && items.length === 0 && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Nothing has been posted yet.
          </p>
        )}

        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <NewsRow key={item.id} item={item} onError={setError} />
          ))}
        </ul>
      </section>
    </div>
  )
}

interface NewsRowProps {
  item: AdminNewsItem
  onError: (message: string | null) => void
}

/**
 * One item, editable in place. Editing is inline rather than in a
 * dialog because news bodies are a sentence or two — a modal would be
 * more ceremony than the content deserves.
 */
function NewsRow({ item, onError }: NewsRowProps) {
  const [body, setBody] = useState(item.body)
  const [editing, setEditing] = useState(false)

  const updateItem = useUpdateNewsItem()
  const deleteItem = useDeleteNewsItem()
  const busy = updateItem.isPending || deleteItem.isPending

  const run = async (action: () => Promise<unknown>) => {
    onError(null)
    try {
      await action()
    } catch (caught) {
      onError(extractApiErrors(caught)[0])
    }
  }

  return (
    <li className="border-b border-edge px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{item.date}</span>
        {item.isPinned && <StatusPill label="Pinned" tone="accent" />}
        {!item.isPublished && <StatusPill label="Draft" tone="warn" />}
        <span className="ml-auto text-xs text-ink-soft">
          {item.authorUsername ?? 'system'} · {formatDateTime(item.createdAt)}
        </span>
      </div>

      {editing ? (
        <TextArea
          value={body}
          maxLength={MAX_BODY_LENGTH}
          className="my-2"
          onChange={(event) => setBody(event.target.value)}
        />
      ) : (
        <p className="my-1 text-sm break-words">{item.body}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={busy || body.trim() === ''}
              onClick={() =>
                void run(async () => {
                  await updateItem.mutateAsync({
                    id: item.id,
                    changes: { body },
                  })
                  setEditing(false)
                })
              }
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setBody(item.body)
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run(() =>
              updateItem.mutateAsync({
                id: item.id,
                changes: { isPinned: !item.isPinned },
              }),
            )
          }
        >
          {item.isPinned ? (
            <PinOff aria-hidden="true" />
          ) : (
            <Pin aria-hidden="true" />
          )}
          {item.isPinned ? 'Unpin' : 'Pin'}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run(() =>
              updateItem.mutateAsync({
                id: item.id,
                changes: { isPublished: !item.isPublished },
              }),
            )
          }
        >
          {item.isPublished ? 'Unpublish' : 'Publish'}
        </Button>

        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => void run(() => deleteItem.mutateAsync(item.id))}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>
    </li>
  )
}
