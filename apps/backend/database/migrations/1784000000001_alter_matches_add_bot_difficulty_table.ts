import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Records the bot difficulty of practice matches ('easy', 'medium' or
 * 'hard'); null for matches between humans.
 */
export default class extends BaseSchema {
  protected tableName = 'matches'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('bot_difficulty', 10).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('bot_difficulty')
    })
  }
}
