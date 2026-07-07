import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '#/lib/api'
import { currentUserQueryOptions } from '#/lib/auth'
import UserAvatar from '#/components/UserAvatar'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_app/_auth/leaderboard')({
  component: LeaderboardPage,
})

const leaderboardQueryOptions = queryOptions({
  queryKey: ['leaderboard'],
  queryFn: async () => {
    const response = await api.get('/api/v1/leaderboard', {})
    return response.data
  },
})

type LeaderboardEntry = NonNullable<
  Awaited<ReturnType<NonNullable<typeof leaderboardQueryOptions.queryFn>>>
>['entries'][number]

/**
 * Global leaderboard: players ranked by public-match win rate once
 * they have played enough public games (docs/features.md).
 */
function LeaderboardPage() {
  const leaderboard = useQuery(leaderboardQueryOptions)
  const { data: currentUser } = useQuery(currentUserQueryOptions)
  const minMatches = leaderboard.data?.minMatches ?? 10
  const entries = leaderboard.data?.entries ?? []

  return (
    <div className="page-wrap max-w-5xl py-8">
      <Link
        to="/play"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to lobby
      </Link>
      <h1 className="m-0 text-2xl font-bold">Leaderboard</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        The top public-match players, ranked by win rate. Play {minMatches}{' '}
        public matches to earn a place. Private games do not count.
      </p>

      {leaderboard.isSuccess && entries.length === 0 && (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Nobody has qualified yet — the first players to finish {minMatches}{' '}
          public matches will appear here.
        </p>
      )}

      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 text-right font-medium">Win rate</th>
                <th className="px-4 py-3 text-right font-medium">Games</th>
                <th className="px-4 py-3 text-right font-medium">Wins</th>
                <th className="px-4 py-3 text-right font-medium">
                  Best streak
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Avg pts / round
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Rounds won
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  Avg players
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <LeaderboardRow
                  key={entry.id}
                  entry={entry}
                  isCurrentUser={entry.id === currentUser?.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  isCurrentUser: boolean
}

function LeaderboardRow({ entry, isCurrentUser }: LeaderboardRowProps) {
  return (
    <tr
      className={cn(
        'border-t border-border',
        isCurrentUser && 'bg-felt/20',
        entry.rank === 1 && 'font-medium',
      )}
    >
      <td className="px-4 py-2 tabular-nums text-muted-foreground">
        {entry.rank}
      </td>
      <td className="px-4 py-2">
        <span className="flex items-center gap-2">
          <UserAvatar user={entry} className="size-7" />
          <span className="font-medium">{entry.username}</span>
          {isCurrentUser && (
            <span className="rounded-full bg-felt px-2 py-0.5 text-xs font-semibold text-white">
              you
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {formatPercent(entry.winRate)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {entry.gamesPlayed}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">{entry.wins}</td>
      <td className="px-4 py-2 text-right tabular-nums">
        {entry.longestWinStreak}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {entry.avgPointsPerRound.toFixed(1)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {formatPercent(entry.roundsWonRate)}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {entry.avgPlayersPerMatch.toFixed(1)}
      </td>
    </tr>
  )
}

/**
 * 0.6 → "60%", 0.3333 → "33.3%".
 */
function formatPercent(rate: number): string {
  const percent = rate * 100
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}
