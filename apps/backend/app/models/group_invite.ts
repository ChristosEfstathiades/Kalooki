import { GroupInviteSchema } from '#database/schema'
import Group from '#models/group'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * A pending group invitation. Accepting creates a GroupMember and
 * deletes the invite; declining or revoking deletes it outright.
 */
export default class GroupInvite extends GroupInviteSchema {
  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
