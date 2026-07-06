import { GroupSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'

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
}
