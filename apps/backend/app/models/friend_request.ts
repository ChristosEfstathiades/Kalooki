import { FriendRequestSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * A pending friend request. Accepting creates a Friendship and deletes
 * the request; declining or cancelling deletes it outright.
 */
export default class FriendRequest extends FriendRequestSchema {
  @belongsTo(() => User, { foreignKey: 'senderId' })
  declare sender: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'recipientId' })
  declare recipient: BelongsTo<typeof User>
}
