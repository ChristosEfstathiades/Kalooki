import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Records each player's net play-money chips for matches played with
 * stakes (docs/Kalooki.md "Play money"). Null for games without chips.
 */
export default class extends BaseSchema {
  protected tableName = 'match_players'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('chips_net').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('chips_net')
    })
  }
}
