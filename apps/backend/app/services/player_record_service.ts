import db from '@adonisjs/lucid/services/db'
import { LEADERBOARD_MIN_MATCHES, getEligiblePlayers, roundTo } from '#services/leaderboard_service'

/**
 * One player's own record, shown on the play page (docs/features.md).
 * The leaderboard only ranks players once they have finished
 * LEADERBOARD_MIN_MATCHES public games and only shows the top 100, so
 * without this a new account has no measure of its own progress at all.
 *
 * The figures count exactly what the board counts: completed public
 * matches. Private and practice games are left out entirely rather than
 * folded in, so a competitive record is never inflated by games that
 * could not qualify for one.
 */

export type PlayerRecord = {
  /** Completed public matches played, the board's own measure. */
  gamesPlayed: number
  wins: number
  /** Wins / games played, 0-1; 0 before anything has been played. */
  winRate: number
  /** Completed public matches needed to qualify for the board. */
  minMatches: number
  /** Position among every ranked player, or null when not ranked. */
  rank: number | null
  /** How many players are ranked in total, for "#47 of 128". */
  rankedPlayers: number
}

/**
 * The signed-in player's public-match record and, once they qualify,
 * where they sit on the leaderboard. An account an admin has excluded
 * from the board is unranked here too, since the rank is read from the
 * very list the board is built from.
 */
export async function getPlayerRecord(userId: number): Promise<PlayerRecord> {
  const publicRow = await db
    .from('match_players')
    .join('matches', 'matches.id', 'match_players.match_id')
    .where('match_players.user_id', userId)
    .where('matches.kind', 'public')
    .where('matches.completed', true)
    .count('* as gamesPlayed')
    .select(db.raw('sum(case when match_players.placement = 1 then 1 else 0 end) as wins'))
    .first()

  const gamesPlayed = Number(publicRow?.gamesPlayed ?? 0)
  const wins = Number(publicRow?.wins ?? 0)

  const eligible = await getEligiblePlayers()
  const index = eligible.findIndex((player) => player.userId === userId)

  return {
    gamesPlayed,
    wins,
    winRate: gamesPlayed === 0 ? 0 : roundTo(wins / gamesPlayed, 4),
    minMatches: LEADERBOARD_MIN_MATCHES,
    rank: index === -1 ? null : index + 1,
    rankedPlayers: eligible.length,
  }
}
