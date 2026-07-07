import Match from '#models/match'
import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { publicUserShape } from '#transformers/public_user_transformer'
import type { RoundResult } from '#services/game/engine'

/**
 * Global leaderboard for public matches (docs/features.md). Only
 * completed public games count — private games use custom rules and
 * incomplete games have no winner, so neither would compare fairly.
 * Players qualify after LEADERBOARD_MIN_MATCHES such games and are
 * ranked by win rate.
 */

/** Completed public matches required before a player is ranked. */
export const LEADERBOARD_MIN_MATCHES = 10

/** Maximum number of ranked players returned. */
export const LEADERBOARD_SIZE = 100

export type LeaderboardEntry = ReturnType<typeof publicUserShape> & {
  rank: number
  gamesPlayed: number
  wins: number
  /** Wins / games played, 0-1. */
  winRate: number
  /** Mean penalty points per scored round (lower is better). */
  avgPointsPerRound: number
  /** Rounds won / rounds played, 0-1. */
  roundsWonRate: number
  /** Most consecutive public-match wins, by match end time. */
  longestWinStreak: number
  /** Mean number of players in their games. */
  avgPlayersPerMatch: number
}

interface EligiblePlayer {
  userId: number
  gamesPlayed: number
  wins: number
  winRate: number
}

/**
 * Rounds to a fixed number of decimals so serialized stats stay tidy.
 */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Users with enough completed public matches to rank, ordered by win
 * rate (ties: more games, then more wins, then lower id).
 */
async function eligiblePlayers(): Promise<EligiblePlayer[]> {
  const aggregates = await db
    .from('match_players')
    .join('matches', 'matches.id', 'match_players.match_id')
    .where('matches.kind', 'public')
    .where('matches.completed', true)
    .groupBy('match_players.user_id')
    .havingRaw('count(*) >= ?', [LEADERBOARD_MIN_MATCHES])
    .select('match_players.user_id as userId')
    .count('* as gamesPlayed')
    .select(db.raw('sum(case when match_players.placement = 1 then 1 else 0 end) as wins'))

  return aggregates
    .map((row): EligiblePlayer => {
      const gamesPlayed = Number(row.gamesPlayed)
      const wins = Number(row.wins)
      return { userId: Number(row.userId), gamesPlayed, wins, winRate: wins / gamesPlayed }
    })
    .sort(
      (a, b) =>
        b.winRate - a.winRate ||
        b.gamesPlayed - a.gamesPlayed ||
        b.wins - a.wins ||
        a.userId - b.userId
    )
}

/**
 * The ranked leaderboard: top players by public-match win rate, with
 * the per-round stats computed from each match's stored scoresheet.
 */
export async function computeLeaderboard(): Promise<LeaderboardEntry[]> {
  const eligible = await eligiblePlayers()
  const ranked = eligible.slice(0, LEADERBOARD_SIZE)
  if (ranked.length === 0) {
    return []
  }

  const userIds = ranked.map((player) => player.userId)
  const users = await User.query().whereIn('id', userIds)
  const usersById = new Map(users.map((user) => [user.id, user]))

  // Every completed public match a ranked player took part in, oldest
  // first so win streaks can be read off in one pass.
  const matches = await Match.query()
    .where('kind', 'public')
    .where('completed', true)
    .whereHas('matchPlayers', (query) => query.whereIn('userId', userIds))
    .preload('matchPlayers')
    .orderBy('endedAt', 'asc')

  const scoresheets = new Map(
    matches.map((match) => [match.id, JSON.parse(match.scoresheet) as RoundResult[]])
  )

  return ranked
    .map((player): LeaderboardEntry | null => {
      const user = usersById.get(player.userId)
      if (!user) {
        return null
      }

      let playerCountTotal = 0
      let roundsPlayed = 0
      let roundsWon = 0
      let pointsTotal = 0
      let streak = 0
      let longestWinStreak = 0

      for (const match of matches) {
        if (!match.matchPlayers.some((entry) => entry.userId === player.userId)) {
          continue
        }
        playerCountTotal += match.matchPlayers.length

        if (match.winnerUserId === player.userId) {
          streak += 1
          longestWinStreak = Math.max(longestWinStreak, streak)
        } else {
          streak = 0
        }

        for (const round of scoresheets.get(match.id) ?? []) {
          // JSON object keys are strings; totals lists every player
          // still in the round (the round winner scores 0).
          if (!(player.userId in round.totals)) {
            continue
          }
          roundsPlayed += 1
          pointsTotal += round.penalties[player.userId] ?? 0
          if (round.winnerUserId === player.userId) {
            roundsWon += 1
          }
        }
      }

      return {
        ...publicUserShape(user),
        rank: 0,
        gamesPlayed: player.gamesPlayed,
        wins: player.wins,
        winRate: roundTo(player.winRate, 4),
        avgPointsPerRound: roundsPlayed === 0 ? 0 : roundTo(pointsTotal / roundsPlayed, 1),
        roundsWonRate: roundsPlayed === 0 ? 0 : roundTo(roundsWon / roundsPlayed, 4),
        longestWinStreak,
        avgPlayersPerMatch:
          player.gamesPlayed === 0 ? 0 : roundTo(playerCountTotal / player.gamesPlayed, 1),
      }
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}
