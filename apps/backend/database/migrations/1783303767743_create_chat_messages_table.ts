import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Chat messages for the global chatroom and per-group chats. Messages
 * are stored (already censored) for 7 days and then deleted by the
 * retention sweep (docs/features.md).
 */
export default class extends BaseSchema {
  protected tableName = 'chat_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      // 'global' for the public chatroom, 'group' for group chats
      table.string('channel', 10).notNullable()
      table.integer('group_id').unsigned().nullable().references('groups.id').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.string('body', 500).notNullable()
      table.boolean('was_censored').notNullable().defaultTo(false)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['channel', 'created_at'])
      table.index(['group_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
