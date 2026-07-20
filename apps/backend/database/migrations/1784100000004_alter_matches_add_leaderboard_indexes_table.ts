import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Indexes for the leaderboard aggregation, which filters matches by
 * kind + completed and joins match_players on match_id. match_players
 * only carried a user_id index, so the join scanned the table.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('matches', (table) => {
      table.index(['kind', 'completed'], 'matches_kind_completed_index')
    })
    this.schema.alterTable('match_players', (table) => {
      table.index(['match_id'], 'match_players_match_id_index')
    })
  }

  async down() {
    this.schema.alterTable('matches', (table) => {
      table.dropIndex(['kind', 'completed'], 'matches_kind_completed_index')
    })
    this.schema.alterTable('match_players', (table) => {
      table.dropIndex(['match_id'], 'match_players_match_id_index')
    })
  }
}
