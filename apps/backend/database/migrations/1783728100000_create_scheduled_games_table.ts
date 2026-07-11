import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Scheduled private games (docs/features.md): a group owner can open a
 * lobby that only becomes joinable at a future time. Persisted so a
 * schedule survives a server restart; the row is deleted when the game
 * starts or the owner cancels. One per group, like live lobbies.
 */
export default class extends BaseSchema {
  protected tableName = 'scheduled_games'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('group_id')
        .unsigned()
        .notNullable()
        .references('groups.id')
        .onDelete('CASCADE')
        .unique()
      table
        .integer('owner_user_id')
        .unsigned()
        .notNullable()
        .references('users.id')
        .onDelete('CASCADE')
      // The custom rules the lobby will use, JSON
      table.text('rules').notNullable()
      table.timestamp('opens_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
