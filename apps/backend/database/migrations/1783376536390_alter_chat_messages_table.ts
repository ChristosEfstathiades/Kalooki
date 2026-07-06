import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Adds in-game match chat (docs/features.md): messages with channel
 * 'match' carry the match's game id — the same id the recorded match
 * row stores — so a game's messages stay associated with it for the
 * 7-day retention window.
 */
export default class extends BaseSchema {
  protected tableName = 'chat_messages'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // The runtime game id (UUID); set when channel is 'match'
      table.string('match_id', 64).nullable()
      table.index(['match_id', 'created_at'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['match_id', 'created_at'])
      table.dropColumn('match_id')
    })
  }
}
