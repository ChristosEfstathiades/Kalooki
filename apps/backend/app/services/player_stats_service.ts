import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import { computeLeaderboard, invalidateLeaderboard } from '#services/leaderboard_service'
import { recordAction } from '#services/moderation_service'
import type User from '#models/user'

/**
 * Admin control over the competitive record: rebuilding the cached
 * leaderboard, and dealing with an account whose stats are not honest.
 *
 * Two responses are offered, because they are not equivalent. Excluding
 * an account hides it from the board and leaves every game intact.
 * Wiping deletes that player's seats in recorded matches, which is
 * irreversible and also changes what their opponents see in their own
 * match history — so it is the second resort, not the first.
 */

/** What a stats reset removed. */
export type StatsResetResult = {
  userId: number
  username: string
  removedSeats: number
  removedWins: number
}

/**
 * Drops the cached board and recomputes it, returning how many players
 * ranked. Used after excluding a player or wiping their record, and
 * available on its own when the board looks stale.
 */
export async function rebuildLeaderboard(): Promise<{ rankedPlayers: number }> {
  invalidateLeaderboard()
  const entries = await computeLeaderboard()
  return { rankedPlayers: entries.length }
}

/**
 * Hides or restores an account on the global leaderboard. Their match
 * history and their opponents' history are untouched.
 */
export async function setLeaderboardExclusion(
  actor: User,
  target: User,
  excluded: boolean,
  reason?: string | null
): Promise<User> {
  if (Boolean(target.excludedFromLeaderboard) === excluded) {
    throw new Exception(
      excluded
        ? 'This user is already excluded from the leaderboard'
        : 'This user is not excluded from the leaderboard',
      { status: 409, code: 'E_EXCLUSION_UNCHANGED' }
    )
  }

  target.excludedFromLeaderboard = excluded
  await target.save()
  invalidateLeaderboard()

  await recordAction({
    action: 'stats.reset',
    actor,
    target,
    reason,
    details: { kind: 'leaderboard-exclusion', excluded },
  })
  return target
}

/**
 * Deletes a player's seats in recorded matches, removing them from the
 * leaderboard and from their own match history. Public matches only by
 * default, since those are what the board is built from.
 *
 * The match rows themselves are kept: other players' history hangs off
 * them, and a match with one seat removed is still a real game.
 */
export async function wipePlayerStats(
  actor: User,
  target: User,
  options: { includePrivate: boolean; reason?: string | null }
): Promise<StatsResetResult> {
  const kinds = options.includePrivate ? ['public', 'private'] : ['public']

  const matchIds = await db
    .from('matches')
    .whereIn('kind', kinds)
    .whereIn('id', db.from('match_players').where('user_id', target.id).select('match_id'))
    .select('id')
  const ids = matchIds.map((row) => Number(row.id))

  if (ids.length === 0) {
    return { userId: target.id, username: target.username, removedSeats: 0, removedWins: 0 }
  }

  const winRows = await db
    .from('match_players')
    .where('user_id', target.id)
    .whereIn('match_id', ids)
    .where('placement', 1)
    .count('* as total')
  const removedWins = Number(winRows[0]?.total ?? 0)

  const removedSeats = await db
    .from('match_players')
    .where('user_id', target.id)
    .whereIn('match_id', ids)
    .delete()

  // A wiped player can no longer be a match's winner
  await db.from('matches').whereIn('id', ids).where('winner_user_id', target.id).update({
    winner_user_id: null,
  })

  invalidateLeaderboard()

  await recordAction({
    action: 'stats.reset',
    actor,
    target,
    reason: options.reason,
    details: {
      kind: 'wipe',
      includePrivate: options.includePrivate,
      removedSeats: Number(removedSeats),
      removedWins,
    },
  })

  return {
    userId: target.id,
    username: target.username,
    removedSeats: Number(removedSeats),
    removedWins,
  }
}
