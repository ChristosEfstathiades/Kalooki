import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Moderation state on the account. A ban is indefinite until lifted:
 * the account still exists but cannot sign in. A mute is timed
 * (muted_until in the future) or permanent (muted_until null while
 * muted_at is set) and only blocks posting in chat, so a muted player
 * can still read chat and play games.
 *
 * The actor columns are nullable and SET NULL on delete so lifting a
 * moderator's own account never erases the moderation history.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('banned_at').nullable()
      table.integer('banned_by').unsigned().nullable().references('users.id').onDelete('SET NULL')
      table.string('ban_reason', 500).nullable()

      table.timestamp('muted_at').nullable()
      table.timestamp('muted_until').nullable()
      table.integer('muted_by').unsigned().nullable().references('users.id').onDelete('SET NULL')
      table.string('mute_reason', 500).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('banned_at')
      table.dropColumn('banned_by')
      table.dropColumn('ban_reason')
      table.dropColumn('muted_at')
      table.dropColumn('muted_until')
      table.dropColumn('muted_by')
      table.dropColumn('mute_reason')
    })
  }
}
