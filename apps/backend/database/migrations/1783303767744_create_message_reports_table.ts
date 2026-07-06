import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Reports of chat messages, for review by admins/moderators
 * (docs/features.md). A user can report a given message once.
 */
export default class extends BaseSchema {
  protected tableName = 'message_reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('message_id')
        .unsigned()
        .notNullable()
        .references('chat_messages.id')
        .onDelete('CASCADE')
      table
        .integer('reporter_id')
        .unsigned()
        .notNullable()
        .references('users.id')
        .onDelete('CASCADE')
      table.unique(['message_id', 'reporter_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
