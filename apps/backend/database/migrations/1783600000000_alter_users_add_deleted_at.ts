import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * When set, the account is soft-deleted: the user requested deletion
 * and has a 30-day grace period to restore it by signing back in.
 * Accounts past the grace period are permanently deleted by the purge
 * job (docs/features.md, User Accounts).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('deleted_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('deleted_at')
    })
  }
}
