import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Resolution state for message reports, so the admin queue can tell an
 * outstanding report from one that has already been dealt with. A
 * report is resolved either as "actioned" (the message was deleted or
 * its author punished) or "dismissed" (nothing was wrong with it), and
 * records which admin decided (docs/features.md, Roles & Moderation).
 */
export default class extends BaseSchema {
  protected tableName = 'message_reports'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.timestamp('resolved_at').nullable()
      table.integer('resolved_by').unsigned().nullable().references('users.id').onDelete('SET NULL')
      // 'actioned' or 'dismissed'; null while the report is open
      table.string('outcome', 20).nullable()
      table.string('resolution_note', 500).nullable()

      // The queue's default view is "open reports, newest first"
      table.index(['resolved_at', 'created_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['resolved_at', 'created_at'])
      table.dropColumn('resolution_note')
      table.dropColumn('outcome')
      table.dropColumn('resolved_by')
      table.dropColumn('resolved_at')
    })
  }
}
