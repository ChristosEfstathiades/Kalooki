import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Megaphone, Send, X } from 'lucide-react'
import {
  ANNOUNCEMENT_DURATIONS,
  ANNOUNCEMENT_TONES,
  settingsQueryOptions,
  useClearAnnouncement,
  usePostGlobalNotice,
  usePublishAnnouncement,
  useUpdateSiteFlags,
} from '#/lib/settings'
import { extractApiErrors } from '#/lib/auth'
import Button from '#/components/Button'
import { Checkbox, Field, Select, TextArea, Toggle } from '#/components/Field'
import { formatDateTime } from '#/lib/utils'
import type { AnnouncementTone, SiteFlags } from '#/lib/settings'

/** Longest banner the backend accepts. */
const MAX_BODY_LENGTH = 500

/**
 * Operational controls: the feature kill switches and the site-wide
 * announcement banner. Both reach connected players over the socket
 * immediately, which is the point — these exist so a problem can be
 * contained without waiting for a deploy.
 */
export default function SettingsPage() {
  const settings = useQuery(settingsQueryOptions)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {error !== null && (
        <p
          role="alert"
          className="m-0 rounded-md border border-danger px-4 py-2 text-sm xl:col-span-2"
        >
          {error}
        </p>
      )}

      <FlagsPanel flags={settings.data?.flags} onError={setError} />
      <AnnouncementPanel
        announcement={settings.data?.announcement ?? null}
        onError={setError}
      />
    </div>
  )
}

interface FlagsPanelProps {
  flags: SiteFlags | undefined
  onError: (message: string | null) => void
}

/**
 * The kill switches. Maintenance mode is separated from the rest
 * because it closes the whole site, not one feature.
 */
function FlagsPanel({ flags, onError }: FlagsPanelProps) {
  const updateFlags = useUpdateSiteFlags()

  const set = async (changes: Partial<SiteFlags>) => {
    onError(null)
    try {
      await updateFlags.mutateAsync(changes)
    } catch (caught) {
      onError(extractApiErrors(caught)[0])
    }
  }

  return (
    <section className="rounded-lg border border-edge bg-panel">
      <header className="border-b border-edge px-4 py-3">
        <h2 className="m-0 text-sm font-semibold">Site controls</h2>
        <p className="m-0 text-xs text-ink-soft">
          Takes effect immediately for everyone connected
        </p>
      </header>

      {flags === undefined ? (
        <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
          Loading…
        </p>
      ) : (
        <div className="space-y-2 p-4">
          <Toggle
            label="Maintenance mode"
            description="Closes the API to everyone but admins. You can still sign in here to turn it back off."
            checked={flags.maintenanceMode}
            disabled={updateFlags.isPending}
            onChange={(checked) => void set({ maintenanceMode: checked })}
          />
          <Toggle
            label="Signups open"
            description="When off, the signup form is closed and the endpoint refuses new accounts."
            checked={flags.signupsEnabled}
            disabled={updateFlags.isPending}
            onChange={(checked) => void set({ signupsEnabled: checked })}
          />
          <Toggle
            label="Public matchmaking"
            description="When off, nobody can join the public queue. Private group games are unaffected."
            checked={flags.publicMatchmakingEnabled}
            disabled={updateFlags.isPending}
            onChange={(checked) =>
              void set({ publicMatchmakingEnabled: checked })
            }
          />
          <Toggle
            label="Practice games"
            description="When off, players cannot start a solo game against bots."
            checked={flags.practiceGamesEnabled}
            disabled={updateFlags.isPending}
            onChange={(checked) => void set({ practiceGamesEnabled: checked })}
          />
        </div>
      )}
    </section>
  )
}

interface AnnouncementPanelProps {
  announcement: {
    body: string
    tone: string
    expiresAt: string | null
    postedAt: string
    postedByUsername: string | null
  } | null
  onError: (message: string | null) => void
}

/**
 * The banner, plus a one-off chat notice for something that does not
 * need to persist.
 */
function AnnouncementPanel({ announcement, onError }: AnnouncementPanelProps) {
  const [body, setBody] = useState('')
  const [tone, setTone] = useState<AnnouncementTone>('info')
  const [durationIndex, setDurationIndex] = useState(1)
  const [alsoPostToChat, setAlsoPostToChat] = useState(true)
  const [noticeBody, setNoticeBody] = useState('')

  const publish = usePublishAnnouncement()
  const clear = useClearAnnouncement()
  const postNotice = usePostGlobalNotice()

  const run = async (action: () => Promise<unknown>) => {
    onError(null)
    try {
      await action()
    } catch (caught) {
      onError(extractApiErrors(caught)[0])
    }
  }

  return (
    <section className="rounded-lg border border-edge bg-panel">
      <header className="border-b border-edge px-4 py-3">
        <h2 className="m-0 text-sm font-semibold">Announcements</h2>
        <p className="m-0 text-xs text-ink-soft">
          A banner across the top of every page on the player site
        </p>
      </header>

      <div className="space-y-4 p-4">
        {announcement !== null && (
          <div className="rounded-md border border-warn bg-surface px-3 py-2">
            <p className="m-0 text-xs text-ink-soft">
              Live · {announcement.tone} · posted by{' '}
              {announcement.postedByUsername ?? 'an admin'}{' '}
              {formatDateTime(announcement.postedAt)}
              {announcement.expiresAt !== null &&
                ` · until ${formatDateTime(announcement.expiresAt)}`}
            </p>
            <p className="m-0 text-sm">{announcement.body}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={clear.isPending}
              onClick={() => void run(() => clear.mutateAsync())}
            >
              <X aria-hidden="true" />
              Take it down
            </Button>
          </div>
        )}

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await publish.mutateAsync({
                body,
                tone,
                durationMinutes: ANNOUNCEMENT_DURATIONS[durationIndex].minutes,
                alsoPostToChat,
              })
              setBody('')
            })
          }}
        >
          <Field
            label="Banner text"
            hint={`${body.length} / ${MAX_BODY_LENGTH}`}
          >
            <TextArea
              value={body}
              required
              maxLength={MAX_BODY_LENGTH}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Server restarting in 10 minutes — finish your hand."
            />
          </Field>

          <div className="flex flex-wrap gap-3">
            <Field label="Tone" className="w-32">
              <Select
                value={tone}
                onChange={(event) =>
                  setTone(event.target.value as AnnouncementTone)
                }
              >
                {ANNOUNCEMENT_TONES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Stays up for" className="w-44">
              <Select
                value={durationIndex}
                onChange={(event) =>
                  setDurationIndex(Number(event.target.value))
                }
              >
                {ANNOUNCEMENT_DURATIONS.map((option, index) => (
                  <option key={option.label} value={index}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Checkbox
            label="Also post it in the global chatroom"
            checked={alsoPostToChat}
            onChange={(event) => setAlsoPostToChat(event.target.checked)}
          />

          <Button
            type="submit"
            disabled={publish.isPending || body.trim() === ''}
          >
            <Megaphone aria-hidden="true" />
            {publish.isPending ? 'Publishing…' : 'Raise banner'}
          </Button>
        </form>

        <form
          className="space-y-2 border-t border-edge pt-4"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              await postNotice.mutateAsync(noticeBody)
              setNoticeBody('')
            })
          }}
        >
          <Field
            label="Chat notice only"
            hint="Posted live into the global chatroom. Never stored, so it cannot be reported or replayed."
          >
            <TextArea
              value={noticeBody}
              maxLength={MAX_BODY_LENGTH}
              onChange={(event) => setNoticeBody(event.target.value)}
              placeholder="Good luck in tonight's games, everyone."
            />
          </Field>
          <Button
            type="submit"
            variant="outline"
            disabled={postNotice.isPending || noticeBody.trim() === ''}
          >
            <Send aria-hidden="true" />
            {postNotice.isPending ? 'Sending…' : 'Post to chat'}
          </Button>
        </form>
      </div>
    </section>
  )
}
