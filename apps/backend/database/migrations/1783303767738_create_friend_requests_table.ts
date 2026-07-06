import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pending friend requests. Accepting one creates a friendships row and
 * deletes the request; declining or cancelling just deletes it.
 */
export default class extends BaseSchema {
  protected tableName = 'friend_requests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('sender_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table
        .integer('recipient_id')
        .unsigned()
        .notNullable()
        .references('users.id')
        .onDelete('CASCADE')
      table.unique(['sender_id', 'recipient_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
