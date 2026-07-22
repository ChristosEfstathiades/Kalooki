import { NewsItemSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * One entry in the news panel on the play page. Unpublished items are
 * drafts: editable in the admin app, invisible to players.
 */
export default class NewsItem extends NewsItemSchema {
  @belongsTo(() => User, { foreignKey: 'authorUserId' })
  declare author: BelongsTo<typeof User>
}
