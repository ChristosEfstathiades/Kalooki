import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Per-player results of a recorded match: final placement, score, and
 * whether they left/forfeited before the end.
 */
export default class extends BaseSchema {
  protected tableName = 'match_players'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('match_id')
        .unsigned()
        .notNullable()
        .references('matches.id')
        .onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.integer('placement').notNullable()
      table.integer('final_score').notNullable()
      table.boolean('left_early').notNullable().defaultTo(false)
      table.unique(['match_id', 'user_id'])
      table.index(['user_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
