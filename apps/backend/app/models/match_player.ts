import { MatchPlayerSchema } from '#database/schema'
import Match from '#models/match'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * One participant's result in a recorded match.
 */
export default class MatchPlayer extends MatchPlayerSchema {
  @belongsTo(() => Match)
  declare match: BelongsTo<typeof Match>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
