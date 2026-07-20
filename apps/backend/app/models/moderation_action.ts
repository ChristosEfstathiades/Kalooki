import { ModerationActionSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * One entry in the moderation audit trail: who did what, to whom, and
 * why. Actor and target usernames are snapshotted on the row so the
 * history survives an account being purged (docs/features.md).
 */
export type ModerationActionName =
  'message.delete' | 'user.ban' | 'user.unban' | 'user.mute' | 'user.unmute' | 'user.role'

export default class ModerationAction extends ModerationActionSchema {
  declare action: ModerationActionName

  @belongsTo(() => User, { foreignKey: 'actorId' })
  declare actor: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'targetUserId' })
  declare target: BelongsTo<typeof User>
}
