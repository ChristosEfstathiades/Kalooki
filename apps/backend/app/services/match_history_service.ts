import { DateTime } from 'luxon'
import Match from '#models/match'
import MatchPlayer from '#models/match_player'
import db from '@adonisjs/lucid/services/db'
import type { ActiveMatch } from '#services/game/match_service'

/**
 * Records finished games for match history (docs/features.md).
 *
 * Interpretation of "incomplete": quitting or timing out forfeits —
 * the game continues and the last player standing wins (consistent
 * with the removal rules in docs/Kalooki.md). A match is only recorded
 * as incomplete, with no winner, when nobody remained to win it. Who
 * left early is noted per player either way.
 */

/**
 * Final placements: the winner first, then everyone who stayed by
 * ascending score, then players who left/forfeited by ascending score.
 */
function placements(match: ActiveMatch): { userId: number; placement: number }[] {
  const players = [...match.state.players]
  players.sort((a, b) => {
    const aWinner = a.userId === match.state.winnerUserId ? 0 : 1
    const bWinner = b.userId === match.state.winnerUserId ? 0 : 1
    if (aWinner !== bWinner) {
      return aWinner - bWinner
    }
    if (a.removed !== b.removed) {
      return a.removed ? 1 : -1
    }
    return a.score - b.score
  })
  return players.map((player, index) => ({ userId: player.userId, placement: index + 1 }))
}

/**
 * Writes the match and its per-player results. Called when a live
 * match finishes.
 */
export async function recordMatch(match: ActiveMatch): Promise<Match> {
  const placementByUser = new Map(placements(match).map((entry) => [entry.userId, entry.placement]))

  return db.transaction(async (trx) => {
    const recorded = await Match.create(
      {
        runtimeId: match.id,
        kind: match.kind,
        groupId: match.groupId,
        botDifficulty: match.botDifficulty,
        rules: JSON.stringify(match.rules),
        scoresheet: JSON.stringify(match.state.roundResults),
        completed: match.state.winnerUserId !== null,
        winnerUserId: match.state.winnerUserId,
        startedAt: DateTime.fromMillis(match.startedAt),
        endedAt: DateTime.fromMillis(match.finishedAt ?? Date.now()),
      },
      { client: trx }
    )

    await MatchPlayer.createMany(
      match.state.players.map((player) => ({
        matchId: recorded.id,
        userId: player.userId,
        placement: placementByUser.get(player.userId) ?? match.state.players.length,
        finalScore: player.score,
        leftEarly: player.removed,
        // Net play money; null distinguishes "no stakes" from "broke even"
        chipsNet: match.rules.stakes ? player.chips : null,
      })),
      { client: trx }
    )

    return recorded
  })
}

/**
 * Optional filters for a user's match history listing.
 */
export interface MatchHistoryFilters {
  /** Only matches of this kind; all kinds when omitted. */
  kind?: 'public' | 'private' | 'practice'
  /** Order by end date; newest first when omitted. */
  sort?: 'newest' | 'oldest'
  /** Only matches the user won. */
  wonOnly?: boolean
}

/**
 * A user's recorded matches with players preloaded, newest first
 * unless the filters say otherwise. Only participants can see a match
 * (enforced here by construction).
 */
export async function matchHistoryFor(
  userId: number,
  filters: MatchHistoryFilters = {},
  limit = 50
): Promise<Match[]> {
  const participations = await MatchPlayer.query().where('userId', userId)
  const matchIds = participations.map((participation) => participation.matchId)
  if (matchIds.length === 0) {
    return []
  }

  const query = Match.query()
    .whereIn('id', matchIds)
    .preload('matchPlayers', (playersQuery) => {
      playersQuery.preload('user')
    })
    .orderBy('endedAt', filters.sort === 'oldest' ? 'asc' : 'desc')
    .limit(limit)

  if (filters.kind) {
    query.where('kind', filters.kind)
  }
  if (filters.wonOnly) {
    query.where('winnerUserId', userId)
  }

  return query
}
