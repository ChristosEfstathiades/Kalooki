import { computeLeaderboard, LEADERBOARD_MIN_MATCHES } from '#services/leaderboard_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class LeaderboardController {
  /**
   * The global public-match leaderboard: players with at least
   * LEADERBOARD_MIN_MATCHES completed public games, ranked by win rate
   * (docs/features.md). minMatches is returned so the UI can state the
   * eligibility rule without hardcoding it.
   */
  async index({ serialize }: HttpContext) {
    const entries = await computeLeaderboard()
    return serialize({ entries, minMatches: LEADERBOARD_MIN_MATCHES })
  }
}
