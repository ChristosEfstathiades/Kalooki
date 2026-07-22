import { SiteSettingSchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

/**
 * One runtime setting, stored as a JSON-encoded value under a stable
 * key. Read and written through #services/site_settings_service rather
 * than directly, so the in-process cache stays correct.
 */
export default class SiteSetting extends SiteSettingSchema {
  @belongsTo(() => User, { foreignKey: 'updatedBy' })
  declare editor: BelongsTo<typeof User>
}
