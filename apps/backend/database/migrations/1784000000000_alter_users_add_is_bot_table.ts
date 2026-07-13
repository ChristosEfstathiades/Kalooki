import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Flags the built-in practice opponents. Bot accounts exist so match
 * history rows can reference them like any player, but they can never
 * sign in and are excluded from friend requests and group invites.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_bot').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_bot')
    })
  }
}
