import { FriendshipSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * An accepted friend connection. The lower user id is always stored in
 * userAId (see #services/friendship_service) so each pair is unique.
 */
export default class Friendship extends FriendshipSchema {
  @belongsTo(() => User, { foreignKey: 'userAId' })
  declare userA: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'userBId' })
  declare userB: BelongsTo<typeof User>
}
