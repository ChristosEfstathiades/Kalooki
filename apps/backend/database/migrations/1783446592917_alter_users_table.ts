import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Optional chat name colour a user has chosen from the fixed palette
 * (docs/features.md, Chat Messages). Null means the default
 * hash-derived colour applies.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('chat_color', 7).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('chat_color')
    })
  }
}
