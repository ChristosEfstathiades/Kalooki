import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Stores the runtime game id (UUID) on recorded matches so rows that
 * reference a live game — such as its chat messages — stay associated
 * with the match after it is recorded.
 */
export default class extends BaseSchema {
  protected tableName = 'matches'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('runtime_id', 64).nullable()
      table.index(['runtime_id'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['runtime_id'])
      table.dropColumn('runtime_id')
    })
  }
}
