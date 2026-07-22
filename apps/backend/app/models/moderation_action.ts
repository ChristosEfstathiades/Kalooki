import { ModerationActionSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * One entry in the moderation audit trail: who did what, to whom, and
 * why. Actor and target usernames are snapshotted on the row so the
 * history survives an account being purged (docs/features.md).
 */
export const MODERATION_ACTION_NAMES = [
  'message.delete',
  'user.ban',
  'user.unban',
  'user.mute',
  'user.unmute',
  'user.role',
  'report.resolve',
  'news.create',
  'news.update',
  'news.delete',
  'site.flags',
  'site.announce',
  'site.announce.clear',
  'stats.reset',
] as const

export type ModerationActionName = (typeof MODERATION_ACTION_NAMES)[number]

export default class ModerationAction extends ModerationActionSchema {
  declare action: ModerationActionName

  @belongsTo(() => User, { foreignKey: 'actorId' })
  declare actor: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'targetUserId' })
  declare target: BelongsTo<typeof User>
}
