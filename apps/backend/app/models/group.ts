import { GroupSchema } from '#database/schema'
import GroupInvite from '#models/group_invite'
import User from '#models/user'
import { belongsTo, hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'

/**
 * A private group. The owner invites friends, manages members, and can
 * transfer ownership or disband the group.
 */
export default class Group extends GroupSchema {
  @belongsTo(() => User, { foreignKey: 'ownerId' })
  declare owner: BelongsTo<typeof User>

  @manyToMany(() => User, {
    pivotTable: 'group_members',
    pivotTimestamps: true,
  })
  declare members: ManyToMany<typeof User>

  @hasMany(() => GroupInvite)
  declare invites: HasMany<typeof GroupInvite>
}
