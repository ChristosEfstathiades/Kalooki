import { MessageReportSchema } from '#database/schema'
import ChatMessage from '#models/chat_message'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * A user's report of a chat message, queued for moderator review.
 */
export default class MessageReport extends MessageReportSchema {
  @belongsTo(() => ChatMessage, { foreignKey: 'messageId' })
  declare message: BelongsTo<typeof ChatMessage>

  @belongsTo(() => User, { foreignKey: 'reporterId' })
  declare reporter: BelongsTo<typeof User>
}
