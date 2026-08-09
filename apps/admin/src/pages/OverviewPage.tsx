import { useQuery } from '@tanstack/react-query'
import { metricsQueryOptions } from '#/lib/metrics'
import ModerationLog from '#/components/ModerationLog'
import StatTile from '#/components/StatTile'
import TrendChart from '#/components/TrendChart'

/**
 * The dashboard's landing section: how big the site is, what happened
 * in the last day and week, and what the game server is doing right
 * now, with the audit feed alongside.
 */
export default function OverviewPage() {
  const metrics = useQuery(metricsQueryOptions)

  if (metrics.isPending) {
    return (
      <p className="m-0 py-8 text-center text-sm text-ink-soft">
        Loading the dashboard…
      </p>
    )
  }

  if (!metrics.data) {
    return (
      <p role="alert" className="m-0 py-8 text-center text-sm text-ink-soft">
        Could not load the dashboard figures.
      </p>
    )
  }

  const { users, matches, chat, reports, live, trend } = metrics.data

  return (
    <div className="space-y-4">
      <section>
        <h2 className="mt-0 mb-2 text-sm font-semibold">Right now</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Players online" value={live.playersOnline} />
          <StatTile
            label="Games in progress"
            value={live.matchesInProgress}
            detail={`${live.publicMatches} public · ${live.privateMatches} private · ${live.practiceMatches} practice`}
          />
          <StatTile
            label="In the queue"
            value={live.playersQueued}
            detail={`${live.openLobbies} open ${live.openLobbies === 1 ? 'lobby' : 'lobbies'}`}
          />
          <StatTile
            label="Open reports"
            value={reports.open}
            detail={`${reports.newToday} filed today · ${reports.resolvedToday} resolved`}
            tone={reports.open > 0 ? 'warn' : 'neutral'}
          />
        </div>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-sm font-semibold">Players</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Accounts"
            value={users.total}
            detail={`${users.bots} bot ${users.bots === 1 ? 'account' : 'accounts'}`}
          />
          <StatTile
            label="New signups"
            value={users.newToday}
            detail={`${users.newThisWeek} in the last 7 days`}
          />
          <StatTile
            label="Banned"
            value={users.banned}
            detail={`${users.muted} currently muted`}
            tone={users.banned > 0 ? 'danger' : 'neutral'}
          />
          <StatTile
            label="Moderators & admins"
            value={users.staff}
            detail="Accounts above player level"
          />
        </div>
      </section>

      <section>
        <h2 className="mt-0 mb-2 text-sm font-semibold">Games & chat</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Matches recorded"
            value={matches.total}
            detail={`${matches.publicCompleted} completed public games`}
          />
          <StatTile
            label="Matches today"
            value={matches.completedToday}
            detail={`${matches.completedThisWeek} in the last 7 days`}
          />
          <StatTile
            label="Messages today"
            value={chat.today}
            detail={`${chat.thisWeek} in the last 7 days`}
          />
          <StatTile
            label="Messages censored"
            value={chat.censored}
            detail={`${chat.deleted} deleted by moderators`}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <TrendChart trend={trend} />
        <ModerationLog />
      </div>
    </div>
  )
}
