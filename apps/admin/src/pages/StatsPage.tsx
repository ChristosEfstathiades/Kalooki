import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { usersQueryOptions } from '#/lib/admin'
import {
  useRebuildLeaderboard,
  useSetLeaderboardExclusion,
  useWipePlayerStats,
} from '#/lib/stats'
import { extractApiErrors } from '#/lib/auth'
import Button from '#/components/Button'
import StatusPill from '#/components/StatusPill'
import { Checkbox, Field, TextInput } from '#/components/Field'
import type { AdminUser } from '#/lib/admin'

/**
 * The competitive-record tools. Two responses to a dishonest account
 * are offered, and they are not equivalent: excluding hides them from
 * the board and leaves every game intact, while wiping deletes their
 * seats and so rewrites their opponents' history too. The destructive
 * one asks for the username to be typed back.
 */
export default function StatsPage() {
  const [search, setSearch] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const users = useQuery(usersQueryOptions({ page: 1, search, role: 'all' }))
  const rebuild = useRebuildLeaderboard()

  const rows = search === '' ? [] : (users.data?.users ?? [])

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
      {message !== null && (
        <p
          role="status"
          className="m-0 rounded-md border border-ok px-4 py-2 text-sm xl:col-span-2"
        >
          {message}
        </p>
      )}

      <section className="rounded-lg border border-edge bg-panel">
        <header className="border-b border-edge px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Leaderboard</h2>
          <p className="m-0 text-xs text-ink-soft">
            The board is cached for a minute at a time and rebuilt whenever a
            public match is recorded
          </p>
        </header>

        <div className="p-4">
          <Button
            disabled={rebuild.isPending}
            onClick={() =>
              void (async () => {
                setError(null)
                setMessage(null)
                try {
                  const result = await rebuild.mutateAsync()
                  setMessage(
                    `Leaderboard rebuilt: ${result.rankedPlayers} ranked players.`,
                  )
                } catch (caught) {
                  setError(extractApiErrors(caught)[0])
                }
              })()
            }
          >
            <RefreshCw aria-hidden="true" />
            {rebuild.isPending ? 'Rebuilding…' : 'Rebuild now'}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-edge bg-panel">
        <header className="border-b border-edge px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Player stats</h2>
          <p className="m-0 mb-3 text-xs text-ink-soft">
            Find an account to exclude from the board or wipe
          </p>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchDraft.trim())
            }}
          >
            <Field label="Account" hideLabel className="flex-1">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-ink-soft"
                />
                <TextInput
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Username or email"
                  aria-label="Find an account"
                  className="pl-7"
                />
              </div>
            </Field>
            <Button size="sm" variant="outline" type="submit">
              Search
            </Button>
          </form>
        </header>

        {search === '' && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            Search for an account to act on.
          </p>
        )}
        {search !== '' && users.isSuccess && rows.length === 0 && (
          <p className="m-0 px-4 py-8 text-center text-sm text-ink-soft">
            No accounts match that search.
          </p>
        )}

        <ul className="m-0 list-none p-0">
          {rows.map((user) => (
            <StatsRow
              key={user.id}
              user={user}
              onError={setError}
              onMessage={setMessage}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}

interface StatsRowProps {
  user: AdminUser
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
}

/**
 * One account's stats controls.
 */
function StatsRow({ user, onError, onMessage }: StatsRowProps) {
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [includePrivate, setIncludePrivate] = useState(false)

  const setExclusion = useSetLeaderboardExclusion()
  const wipe = useWipePlayerStats()
  const busy = setExclusion.isPending || wipe.isPending
  const confirmed = confirmation === user.username

  const run = async (action: () => Promise<string>) => {
    onError(null)
    onMessage(null)
    try {
      onMessage(await action())
    } catch (caught) {
      onError(extractApiErrors(caught)[0])
    }
  }

  return (
    <li className="border-b border-edge px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{user.username}</span>
        {user.excludedFromLeaderboard && (
          <StatusPill label="Excluded" tone="warn" />
        )}
        {user.isBanned && <StatusPill label="Banned" tone="danger" />}
        <span className="ml-auto text-xs text-ink-soft">{user.email}</span>
      </div>

      <div className="mt-2 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Reason" className="flex-1">
            <TextInput
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Recorded in the audit trail"
            />
          </Field>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await setExclusion.mutateAsync({
                  userId: user.id,
                  excluded: !user.excludedFromLeaderboard,
                  reason: reason || undefined,
                })
                return user.excludedFromLeaderboard
                  ? `${user.username} is back on the leaderboard.`
                  : `${user.username} is hidden from the leaderboard.`
              })
            }
          >
            {user.excludedFromLeaderboard
              ? 'Restore to leaderboard'
              : 'Exclude from leaderboard'}
          </Button>
        </div>

        <div className="rounded-md border border-danger px-3 py-2">
          <p className="m-0 flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            Wipe recorded stats
          </p>
          <p className="m-0 mb-2 text-xs text-ink-soft">
            Deletes this player's seats in recorded matches. Irreversible, and
            it changes what their opponents see in their own match history.
            Prefer excluding them unless the games themselves were fraudulent.
          </p>

          <div className="flex flex-wrap items-end gap-2">
            <Checkbox
              label="Private games too"
              checked={includePrivate}
              onChange={(event) => setIncludePrivate(event.target.checked)}
              className="pb-1"
            />
            <Field
              label={`Type ${user.username} to confirm`}
              className="flex-1"
            >
              <TextInput
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={user.username}
              />
            </Field>
            <Button
              size="sm"
              variant="danger"
              disabled={busy || !confirmed}
              onClick={() =>
                void run(async () => {
                  const result = await wipe.mutateAsync({
                    userId: user.id,
                    includePrivate,
                    reason: reason || undefined,
                  })
                  setConfirmation('')
                  return `Removed ${result.removedSeats} recorded games (${result.removedWins} wins) from ${result.username}.`
                })
              }
            >
              Wipe stats
            </Button>
          </div>
        </div>
      </div>
    </li>
  )
}
