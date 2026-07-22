import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A small key/value store for operational settings an admin can change
 * at runtime: the feature kill switches (signups, matchmaking,
 * practice), maintenance mode, and the site-wide announcement banner.
 * Values are JSON text so a setting can grow past a boolean without a
 * migration; #services/site_settings_service is the only reader.
 */
export default class extends BaseSchema {
  protected tableName = 'site_settings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('key', 64).notNullable().unique()
      table.text('value').notNullable()
      table.integer('updated_by').unsigned().nullable().references('users.id').onDelete('SET NULL')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
