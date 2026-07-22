import { findModerationTarget } from '#services/moderation_service'
import {
  rebuildLeaderboard,
  setLeaderboardExclusion,
  wipePlayerStats,
} from '#services/player_stats_service'
import { leaderboardExclusionValidator, wipeStatsValidator } from '#validators/admin'
import { moderationUserShape } from '#transformers/moderation_user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Competitive-record tools on admin.{domain}: rebuilding the cached
 * leaderboard and dealing with an account whose stats are not honest.
 */
export default class AdminStatsController {
  /**
   * Drops the cached leaderboard and recomputes it, for when the board
   * looks stale or a change should show immediately.
   */
  async rebuildLeaderboard({ serialize }: HttpContext) {
    return serialize(await rebuildLeaderboard())
  }

  /**
   * Hides or restores an account on the global leaderboard. Match
   * history is untouched, so this is the proportionate response.
   */
  async setExclusion({ auth, params, request, serialize }: HttpContext) {
    const { excluded, reason } = await request.validateUsing(leaderboardExclusionValidator)
    const target = await findModerationTarget(Number(params.userId))
    await setLeaderboardExclusion(auth.getUserOrFail(), target, excluded, reason)

    return serialize({ user: moderationUserShape(target) })
  }

  /**
   * Deletes a player's seats in recorded matches. Irreversible, and it
   * also changes what their opponents see in their own history, so the
   * admin app asks for confirmation before calling this.
   */
  async wipe({ auth, params, request, serialize }: HttpContext) {
    const { includePrivate, reason } = await request.validateUsing(wipeStatsValidator)
    const target = await findModerationTarget(Number(params.userId))
    const result = await wipePlayerStats(auth.getUserOrFail(), target, {
      includePrivate: includePrivate ?? false,
      reason,
    })

    return serialize(result)
  }
}
