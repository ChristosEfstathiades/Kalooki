import { GroupMemberSchema } from '#database/schema'
import Group from '#models/group'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * A group membership row. The owner has one too.
 */
export default class GroupMember extends GroupMemberSchema {
  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
