import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Moderator deletion of a chat message. The row is kept rather than
 * removed so an outstanding report stays actionable and the audit trail
 * can point at the message; the retention sweep clears it with every
 * other message after 30 days. Deleted messages are hidden from every
 * client, including their author.
 */
export default class extends BaseSchema {
  protected tableName = 'chat_messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('deleted_at').nullable()
      table.integer('deleted_by').unsigned().nullable().references('users.id').onDelete('SET NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('deleted_at')
      table.dropColumn('deleted_by')
    })
  }
}
