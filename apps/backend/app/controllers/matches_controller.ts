import { matchHistoryFor } from '#services/match_history_service'
import { matchHistoryFilterValidator } from '#validators/match'
import MatchTransformer from '#transformers/match_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class MatchesController {
  /**
   * The user's match history, filterable by kind, end-date order, and
   * won-only. Matches are only ever listed for their participants
   * (docs/features.md).
   */
  async index({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const filters = await request.validateUsing(matchHistoryFilterValidator)
    const matches = await matchHistoryFor(user.id, filters)
    return serialize({ matches: MatchTransformer.transform(matches) })
  }
}
