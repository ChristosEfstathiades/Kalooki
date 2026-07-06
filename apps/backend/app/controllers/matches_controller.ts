import { matchHistoryFor } from '#services/match_history_service'
import MatchTransformer from '#transformers/match_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class MatchesController {
  /**
   * The user's match history, newest first. Matches are only ever
   * listed for their participants (docs/features.md).
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const matches = await matchHistoryFor(user.id)
    return serialize({ matches: MatchTransformer.transform(matches) })
  }
}
