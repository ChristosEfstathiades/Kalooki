import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Authorization level for the account: 'player' (everyone), 'moderator'
 * (a regular player who can also delete chat messages and ban/mute
 * users), or 'admin' (moderator powers plus the admin subdomain). The
 * levels are hierarchical, so an admin can do anything a moderator can
 * (docs/features.md, Roles & Moderation).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('role', 16).notNullable().defaultTo('player')
      table.index(['role'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['role'])
      table.dropColumn('role')
    })
  }
}
