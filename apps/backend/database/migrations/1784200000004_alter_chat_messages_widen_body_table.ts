import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Widens the chat message body (and the copy the moderation audit trail
 * keeps of a deleted message) from 500 to 1000 characters, so
 * moderators and admins can post up to the longer staff limit in
 * #services/chat_service while players stay capped at 500.
 */
export default class extends BaseSchema {
  protected tableName = 'chat_messages'
  private moderationTableName = 'moderation_actions'

  /**
   * SQLite ignores varchar lengths altogether and knex can only alter a
   * column there by rebuilding the whole table (dropping its foreign
   * keys and indexes in the process), so the widening is a no-op on the
   * development/test database.
   */
  private get isSqlite(): boolean {
    return ['sqlite3', 'better-sqlite3', 'libsql'].includes(this.db.dialect.name)
  }

  async up() {
    if (this.isSqlite) {
      return
    }

    this.schema.alterTable(this.tableName, (table) => {
      table.string('body', 1000).notNullable().alter()
    })

    this.schema.alterTable(this.moderationTableName, (table) => {
      table.string('message_body', 1000).nullable().alter()
    })
  }

  async down() {
    if (this.isSqlite) {
      return
    }

    // Narrowing back would fail on any staff message already over 500
    this.defer(async (db) => {
      await db.rawQuery(`update ${this.tableName} set body = substr(body, 1, 500)`)
      await db.rawQuery(
        `update ${this.moderationTableName} set message_body = substr(message_body, 1, 500)`
      )
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.string('body', 500).notNullable().alter()
    })

    this.schema.alterTable(this.moderationTableName, (table) => {
      table.string('message_body', 500).nullable().alter()
    })
  }
}
