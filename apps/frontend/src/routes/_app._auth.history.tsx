import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '#/lib/api'
import { currentUserQueryOptions } from '#/lib/auth'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/_auth/history')({
  component: HistoryPage,
})

const matchesQueryOptions = queryOptions({
  queryKey: ['matches'],
  queryFn: async () => {
    const response = await api.get('/api/v1/matches', {})
    return response.data.matches
  },
})

type MatchRecord = NonNullable<
  Awaited<ReturnType<NonNullable<typeof matchesQueryOptions.queryFn>>>
>[number]

/**
 * Match history: every game the user played, newest first, with a
 * click-to-expand scoresheet (docs/Frontend-design.md).
 */
function HistoryPage() {
  const matches = useQuery(matchesQueryOptions)
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  return (
    <div className="page-wrap max-w-4xl py-8">
      <Link
        to="/play"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to lobby
      </Link>
      <h1 className="m-0 text-2xl font-bold">Match history</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Every game you have played. Click a match for the full scoresheet.
      </p>

      {matches.isSuccess && matches.data.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          No games yet — find a public match or start one in a group.
        </p>
      )}

      <ul className="m-0 list-none space-y-2 p-0">
        {(matches.data ?? []).map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            currentUserId={currentUser?.id ?? 0}
            expanded={expandedId === match.id}
            onToggle={() =>
              setExpandedId(expandedId === match.id ? null : match.id)
            }
          />
        ))}
      </ul>
    </div>
  )
}

interface MatchRowProps {
  match: MatchRecord
  currentUserId: number
  expanded: boolean
  onToggle: () => void
}

function MatchRow({ match, currentUserId, expanded, onToggle }: MatchRowProps) {
  const you = match.players.find((player) => player.id === currentUserId)
  const winner = match.players.find(
    (player) => player.id === match.winnerUserId,
  )
  const date = match.startedAt ? new Date(match.startedAt).toLocaleString() : ''
  const minutes = Math.max(1, Math.round(match.durationSeconds / 60))

  return (
    <li className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {expanded ? (
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {match.kind === 'public' ? 'Public match' : 'Private match'} ·{' '}
            {match.players.map((player) => player.username).join(', ')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {date} · {minutes} min ·{' '}
            {match.completed
              ? winner
                ? `${winner.username} won`
                : 'Finished'
              : 'Incomplete — no winner'}
          </span>
        </span>
        {you && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
              you.placement === 1
                ? 'bg-felt text-white'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {ordinal(you.placement)}
          </span>
        )}
      </button>

      {expanded && <MatchDetail match={match} />}
    </li>
  )
}

interface MatchDetailProps {
  match: MatchRecord
}

function MatchDetail({ match }: MatchDetailProps) {
  return (
    <div className="space-y-4 border-t border-border px-4 py-3 text-sm">
      <section>
        <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Final standings
        </h3>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Place</th>
              <th className="py-1 font-medium">Player</th>
              <th className="py-1 font-medium">Score</th>
              <th className="py-1 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {match.players.map((player) => (
              <tr key={player.id} className="border-t border-border">
                <td className="py-1">{ordinal(player.placement)}</td>
                <td className="py-1">{player.username}</td>
                <td className="py-1">{player.finalScore}</td>
                <td className="py-1 text-xs text-muted-foreground">
                  {player.leftEarly ? 'left early' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {match.scoresheet.length > 0 && (
        <section>
          <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Round by round
          </h3>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Round</th>
                  {match.players.map((player) => (
                    <th key={player.id} className="py-1 font-medium">
                      {player.username}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {match.scoresheet.map((round) => (
                  <tr
                    key={round.roundNumber}
                    className="border-t border-border"
                  >
                    <td className="py-1">{round.roundNumber}</td>
                    {match.players.map((player) => (
                      <td key={player.id} className="py-1">
                        {player.id in round.totals ? (
                          <>
                            {round.totals[player.id]}
                            <span className="ml-1 text-xs text-muted-foreground">
                              (+{round.penalties[player.id] ?? 0})
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="text-xs text-muted-foreground">
        Rules: {match.rules.decks} decks · {match.rules.jokers} jokers · come
        down at {match.rules.comeDownThreshold} · out at{' '}
        {match.rules.scoreLimit + 1}
      </section>
    </div>
  )
}

/**
 * 1 → 1st, 2 → 2nd, 3 → 3rd, everything else → Nth.
 */
function ordinal(place: number): string {
  const suffix =
    place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'
  return `${place}${suffix}`
}
