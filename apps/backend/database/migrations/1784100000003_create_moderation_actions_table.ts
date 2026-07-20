import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Audit trail of every moderator and admin action (docs/features.md,
 * Roles & Moderation). Actor and target are SET NULL on delete, and
 * both usernames are snapshotted alongside them, so the history stays
 * readable after an account is purged.
 */
export default class extends BaseSchema {
  protected tableName = 'moderation_actions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      // 'message.delete' | 'user.ban' | 'user.unban' | 'user.mute'
      // | 'user.unmute' | 'user.role'
      table.string('action', 32).notNullable()

      table.integer('actor_id').unsigned().nullable().references('users.id').onDelete('SET NULL')
      table.string('actor_username', 32).notNullable()
      table.string('actor_role', 16).notNullable()

      table
        .integer('target_user_id')
        .unsigned()
        .nullable()
        .references('users.id')
        .onDelete('SET NULL')
      table.string('target_username', 32).nullable()

      // Set for 'message.delete'; the message row itself is soft-deleted
      table.integer('message_id').unsigned().nullable()
      table.string('message_channel', 10).nullable()
      table.string('message_body', 500).nullable()

      table.string('reason', 500).nullable()
      // Extra context as JSON, e.g. a role change's from/to or a mute's
      // duration. Stored as text so it works on SQLite and Postgres.
      table.text('details').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['created_at'])
      table.index(['target_user_id', 'created_at'])
      table.index(['action', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
