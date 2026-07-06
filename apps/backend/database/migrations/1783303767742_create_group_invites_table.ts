import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pending group invitations. Accepting one creates a group_members row
 * and deletes the invite; declining or revoking just deletes it.
 */
export default class extends BaseSchema {
  protected tableName = 'group_invites'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('group_id').unsigned().notNullable().references('groups.id').onDelete('CASCADE')
      table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')
      table.unique(['group_id', 'user_id'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
