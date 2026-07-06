import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Private groups. The owner is the only member who can invite, remove
 * members, transfer ownership, or delete the group.
 */
export default class extends BaseSchema {
  protected tableName = 'groups'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name', 50).notNullable()
      table.integer('owner_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
