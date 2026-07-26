import { getPlayerRecord } from '#services/player_record_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class PlayerRecordController {
  /**
   * The signed-in player's own public-match record, with their
   * leaderboard position once they qualify. Backs the record card on
   * the play page (docs/features.md, Your Record).
   */
  async show({ auth, serialize }: HttpContext) {
    const record = await getPlayerRecord(auth.getUserOrFail().id)
    return serialize({ record })
  }
}
