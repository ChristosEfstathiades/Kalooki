import { MessageReportSchema } from '#database/schema'
import ChatMessage from '#models/chat_message'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * How an admin closed a report: the message was removed or its author
 * punished ('actioned'), or there was nothing wrong with it
 * ('dismissed'). Null while the report is still open.
 */
export type ReportOutcome = 'actioned' | 'dismissed'

/**
 * A user's report of a chat message, queued for moderator review.
 */
export default class MessageReport extends MessageReportSchema {
  declare outcome: ReportOutcome | null

  @belongsTo(() => ChatMessage, { foreignKey: 'messageId' })
  declare message: BelongsTo<typeof ChatMessage>

  @belongsTo(() => User, { foreignKey: 'reporterId' })
  declare reporter: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'resolvedBy' })
  declare resolver: BelongsTo<typeof User>
}
