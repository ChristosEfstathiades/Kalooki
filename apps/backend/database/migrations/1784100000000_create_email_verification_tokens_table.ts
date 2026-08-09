import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Email verification tokens (AUDIT.md G1). Production signup mints one
 * of these and mails the user a link carrying the raw token; login
 * refuses the account until it is redeemed.
 *
 * Only the SHA-256 hash of the token is stored. The table is readable by
 * anything with database access (a backup, a support query, a leak), and
 * a raw token in there would be a live credential able to verify someone
 * else's address. Tokens are single-use (`used_at`) and expiring
 * (`expires_at`); see #services/email_verification_service.
 */
export default class extends BaseSchema {
  protected tableName = 'email_verification_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE')

      // Unique so a hash collision or a replayed insert surfaces as an
      // error rather than two rows redeeming the same link. Indexed
      // because redemption looks the token up by this column alone.
      table.string('token_hash').notNullable().unique()

      table.timestamp('expires_at').notNullable()
      table.timestamp('used_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Reissuing invalidates a user's outstanding tokens, which scans
      // by user.
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
