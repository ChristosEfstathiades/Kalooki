import { ChatMessageSchema } from '#database/schema'
import Group from '#models/group'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * A chat message in the global chatroom (channel 'global') or a group
 * chat (channel 'group' + groupId). The body is stored already
 * censored; wasCensored records that the original tripped the filter.
 */
export default class ChatMessage extends ChatMessageSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>
}
