import { ChatMessageSchema } from '#database/schema'
import Group from '#models/group'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * A chat message in the global chatroom (channel 'global'), a group
 * chat (channel 'group' + groupId), or a live game's table chat
 * (channel 'match' + matchId, the runtime game id also stored on the
 * recorded match). The body is stored already censored; wasCensored
 * records that the original tripped the filter.
 */
export default class ChatMessage extends ChatMessageSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Group)
  declare group: BelongsTo<typeof Group>
}
