import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Recorded games for match history (docs/features.md). Kept
 * indefinitely; visible only to participants. The scoresheet and the
 * rules in effect are stored as JSON text.
 */
export default class extends BaseSchema {
  protected tableName = 'matches'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      // 'public' (classic rules) or 'private' (group game)
      table.string('kind', 10).notNullable()
      table.integer('group_id').unsigned().nullable().references('groups.id').onDelete('SET NULL')
      table.text('rules').notNullable()
      // Round-by-round penalties and totals, JSON
      table.text('scoresheet').notNullable()
      table.boolean('completed').notNullable()
      table
        .integer('winner_user_id')
        .unsigned()
        .nullable()
        .references('users.id')
        .onDelete('SET NULL')
      table.timestamp('started_at').notNullable()
      table.timestamp('ended_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
