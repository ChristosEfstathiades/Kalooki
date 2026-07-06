import { MatchSchema } from '#database/schema'
import MatchPlayer from '#models/match_player'
import User from '#models/user'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

/**
 * A recorded game. Kept indefinitely and visible only to its
 * participants (docs/features.md). Rules and the round-by-round
 * scoresheet are stored as JSON text.
 */
export default class Match extends MatchSchema {
  @hasMany(() => MatchPlayer)
  declare matchPlayers: HasMany<typeof MatchPlayer>

  @belongsTo(() => User, { foreignKey: 'winnerUserId' })
  declare winner: BelongsTo<typeof User>
}
