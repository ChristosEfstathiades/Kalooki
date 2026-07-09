import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Permanently deletes accounts whose 30-day soft-delete grace period
 * has passed. The running server also does this automatically (see
 * providers/account_purge_provider.ts); this command exists for manual
 * runs and external schedulers (cron).
 */
export default class PurgeDeletedAccounts extends BaseCommand {
  static commandName = 'accounts:purge'
  static description = 'Permanently delete accounts whose soft-delete grace period has passed'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const { purgeExpiredAccounts } = await import('#services/account_deletion_service')
    const purged = await purgeExpiredAccounts()
    this.logger.info(`Permanently deleted ${purged} account(s)`)
  }
}
