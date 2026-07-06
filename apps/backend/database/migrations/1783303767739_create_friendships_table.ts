import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Accepted friend connections. Each friendship is a single row with
 * the lower user id in user_a_id (enforced by the friendship service)
 * so a pair can only ever appear once.
 */
export default class extends BaseSchema {
  protected tableName = 'friendships'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_a_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.integer('user_b_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.unique(['user_a_id', 'user_b_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
