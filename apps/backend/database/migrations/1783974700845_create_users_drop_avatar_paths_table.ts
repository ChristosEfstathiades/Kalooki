import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Drops the users.avatar_path column: avatars are now DiceBear "bottts"
 * robots generated from the username, so no uploaded image is stored.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('avatar_path')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('avatar_path').nullable()
    })
  }
}
