import User from '#models/user'
import db from '@adonisjs/lucid/services/db'
import { publicUserShape } from '#transformers/public_user_transformer'
import type { DatabaseQueryBuilderContract } from '@adonisjs/lucid/types/querybuilder'
import type { RoundResult } from '#services/game/engine'

/**
 * Global leaderboard for public matches (docs/features.md). Only
 * completed public games count — private games use custom rules and
 * incomplete games have no winner, so neither would compare fairly.
 * Players qualify after LEADERBOARD_MIN_MATCHES such games and are
 * ranked by win rate.
 *
 * The board is identical for every user, so requests are served from a
 * short-lived process-wide cache (see getLeaderboard) rather than
 * rescanning the match table per request.
 */

/** Completed public matches required before a player is ranked. */
export const LEADERBOARD_MIN_MATCHES = 10

/** Maximum number of ranked players returned. */
export const LEADERBOARD_SIZE = 100

/** How long a computed board is served before it is recomputed. */
export const LEADERBOARD_CACHE_MS = 60_000

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

/** Per-player totals accumulated over one pass of the match rows. */
interface PlayerTotals {
  playerCountTotal: number
  roundsPlayed: number
  roundsWon: number
  pointsTotal: number
  /** Running streak of the matches seen so far, not itself reported. */
  currentStreak: number
  longestWinStreak: number
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
    // Accounts an admin has excluded (e.g. caught cheating) keep their
    // history but never appear on the board.
    .whereNotIn(
      'match_players.user_id',
      db.from('users').where('excluded_from_leaderboard', true).select('id')
    )
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
 * Narrows a query on `matches` to the completed public matches at least
 * one ranked player took part in. Uses a plain IN subquery rather than
 * a correlated EXISTS, and rather than passing the match ids back as
 * bind parameters (there can be tens of thousands of them).
 */
function scopeToRankedMatches(
  query: DatabaseQueryBuilderContract,
  userIds: number[]
): DatabaseQueryBuilderContract {
  return query
    .where('matches.kind', 'public')
    .where('matches.completed', true)
    .whereIn('matches.id', db.from('match_players').whereIn('user_id', userIds).select('match_id'))
}

/**
 * Every ranked player's stats, accumulated in a single pass over the
 * match rows. Ordering the rows by end time lets win streaks be read
 * off as the pass goes.
 */
async function totalsForRankedPlayers(userIds: number[]): Promise<Map<number, PlayerTotals>> {
  const totals = new Map<number, PlayerTotals>(
    userIds.map((userId) => [
      userId,
      {
        playerCountTotal: 0,
        roundsPlayed: 0,
        roundsWon: 0,
        pointsTotal: 0,
        currentStreak: 0,
        longestWinStreak: 0,
      },
    ])
  )

  // Seats first, so each match row can be attributed without a second
  // scan. Plain rows rather than models: nothing here needs hydrating.
  const seatRows = await scopeToRankedMatches(
    db.from('match_players').join('matches', 'matches.id', 'match_players.match_id'),
    userIds
  ).select('match_players.match_id as matchId', 'match_players.user_id as userId')

  const seatsByMatch = new Map<number, number[]>()
  for (const row of seatRows) {
    const matchId = Number(row.matchId)
    const seats = seatsByMatch.get(matchId)
    if (seats) {
      seats.push(Number(row.userId))
    } else {
      seatsByMatch.set(matchId, [Number(row.userId)])
    }
  }

  const matchRows = await scopeToRankedMatches(db.from('matches'), userIds)
    .orderBy('matches.ended_at', 'asc')
    .orderBy('matches.id', 'asc')
    .select('matches.id as id', 'matches.winner_user_id as winnerUserId')
    .select('matches.scoresheet as scoresheet')

  for (const matchRow of matchRows) {
    const seats = seatsByMatch.get(Number(matchRow.id)) ?? []
    const rankedSeats = seats.filter((userId) => totals.has(userId))
    if (rankedSeats.length === 0) {
      continue
    }

    const winnerUserId = matchRow.winnerUserId === null ? null : Number(matchRow.winnerUserId)
    const rounds = JSON.parse(String(matchRow.scoresheet)) as RoundResult[]

    for (const userId of rankedSeats) {
      const player = totals.get(userId)
      if (!player) {
        continue
      }
      player.playerCountTotal += seats.length

      if (winnerUserId === userId) {
        player.currentStreak += 1
        player.longestWinStreak = Math.max(player.longestWinStreak, player.currentStreak)
      } else {
        player.currentStreak = 0
      }

      for (const round of rounds) {
        // JSON object keys are strings; totals lists every player
        // still in the round (the round winner scores 0).
        if (!(userId in round.totals)) {
          continue
        }
        player.roundsPlayed += 1
        player.pointsTotal += round.penalties[userId] ?? 0
        if (round.winnerUserId === userId) {
          player.roundsWon += 1
        }
      }
    }
  }

  return totals
}

/**
 * The ranked leaderboard: top players by public-match win rate, with
 * the per-round stats computed from each match's stored scoresheet.
 * Prefer getLeaderboard, which caches this.
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
  const totals = await totalsForRankedPlayers(userIds)

  return ranked
    .map((player): LeaderboardEntry | null => {
      const user = usersById.get(player.userId)
      const stats = totals.get(player.userId)
      if (!user || !stats) {
        return null
      }

      return {
        ...publicUserShape(user),
        rank: 0,
        gamesPlayed: player.gamesPlayed,
        wins: player.wins,
        winRate: roundTo(player.winRate, 4),
        avgPointsPerRound:
          stats.roundsPlayed === 0 ? 0 : roundTo(stats.pointsTotal / stats.roundsPlayed, 1),
        roundsWonRate:
          stats.roundsPlayed === 0 ? 0 : roundTo(stats.roundsWon / stats.roundsPlayed, 4),
        longestWinStreak: stats.longestWinStreak,
        avgPlayersPerMatch:
          player.gamesPlayed === 0 ? 0 : roundTo(stats.playerCountTotal / player.gamesPlayed, 1),
      }
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

let cached: { entries: LeaderboardEntry[]; computedAt: number } | null = null
let inFlight: Promise<LeaderboardEntry[]> | null = null

/**
 * The leaderboard, served from cache when it is fresh. Concurrent
 * misses share one computation instead of each rescanning the match
 * table.
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  if (cached && Date.now() - cached.computedAt < LEADERBOARD_CACHE_MS) {
    return cached.entries
  }
  if (!inFlight) {
    inFlight = computeLeaderboard()
      .then((entries) => {
        cached = { entries, computedAt: Date.now() }
        return entries
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/**
 * Drops the cached board so the next request recomputes. Called when a
 * public match is recorded, and by tests between cases.
 */
export function invalidateLeaderboard(): void {
  cached = null
}
