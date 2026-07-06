import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Group membership rows, including one for the owner. Groups are
 * capped at 50 members (enforced by the group service).
 */
export default class extends BaseSchema {
  protected tableName = 'group_members'

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
