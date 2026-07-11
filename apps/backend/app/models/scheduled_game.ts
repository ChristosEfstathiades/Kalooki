import { ScheduledGameSchema } from '#database/schema'
import Group from '#models/group'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * A private game scheduled to open at a future time. Mirrors the
 * in-memory lobby so a pending schedule survives a server restart;
 * deleted once the game starts or is cancelled.
 */
export default class ScheduledGame extends ScheduledGameSchema {
  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>

  @belongsTo(() => User, { foreignKey: 'ownerUserId' })
  declare owner: BelongsTo<typeof User>
}
