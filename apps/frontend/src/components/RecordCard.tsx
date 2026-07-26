import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { formatPercent, playerRecordQueryOptions } from '#/lib/stats'

/**
 * The signed-in player's own public-match record, on the play page. The
 * leaderboard only ranks players after ten public games and only shows
 * the top hundred, so this is the one place a new account can watch its
 * own progress from the very first match (docs/features.md).
 */
export default function RecordCard() {
  const { data: record } = useQuery(playerRecordQueryOptions)

  if (!record) {
    return null
  }

  const { gamesPlayed, wins, winRate, minMatches, rank, rankedPlayers } = record
  const remaining = Math.max(0, minMatches - gamesPlayed)

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="m-0 text-xl font-bold">Your record</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        Public matches only. Private and practice games never count toward the
        leaderboard.
      </p>

      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Stat value={String(gamesPlayed)} label="Played" />
        <Stat value={String(wins)} label="Won" />
        <Stat value={formatPercent(winRate)} label="Win rate" />
      </div>

      {rank !== null ? (
        <p className="mt-4 mb-0 text-sm">
          <Link to="/leaderboard" className="font-semibold hover:underline">
            Ranked #{rank}
          </Link>{' '}
          <span className="text-muted-foreground">of {rankedPlayers}</span>
        </p>
      ) : (
        remaining > 0 && (
          <EligibilityProgress
            gamesPlayed={gamesPlayed}
            minMatches={minMatches}
            remaining={remaining}
          />
        )
      )}
    </div>
  )
}

interface StatProps {
  value: string
  label: string
}

/**
 * One figure with its caption underneath.
 */
function Stat({ value, label }: StatProps) {
  return (
    <div>
      <p className="m-0 text-2xl font-bold tabular-nums">{value}</p>
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

interface EligibilityProgressProps {
  gamesPlayed: number
  minMatches: number
  remaining: number
}

/**
 * How close the player is to qualifying for the leaderboard. Shown only
 * until they rank, at which point their position replaces it.
 */
function EligibilityProgress({
  gamesPlayed,
  minMatches,
  remaining,
}: EligibilityProgressProps) {
  const percent = Math.min(100, (gamesPlayed / minMatches) * 100)

  return (
    <div className="mt-4">
      <div
        role="progressbar"
        aria-label="Progress toward leaderboard eligibility"
        aria-valuenow={gamesPlayed}
        aria-valuemin={0}
        aria-valuemax={minMatches}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-felt transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 mb-0 text-sm text-muted-foreground">
        {gamesPlayed === 0
          ? `Play ${minMatches} public matches to join the leaderboard`
          : `${remaining} more public ${
              remaining === 1 ? 'match' : 'matches'
            } to rank`}
      </p>
    </div>
  )
}

