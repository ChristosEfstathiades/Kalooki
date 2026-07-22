import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lets an admin drop an account from the global leaderboard without
 * destroying its match history — the proportionate response to a player
 * caught inflating their record, where wiping the games would also
 * rewrite their opponents' history.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('excluded_from_leaderboard').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('excluded_from_leaderboard')
    })
  }
}
