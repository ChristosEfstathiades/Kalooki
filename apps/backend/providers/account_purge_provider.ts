import type { ApplicationService } from '@adonisjs/core/types'

/**
 * How often the running server sweeps for accounts whose soft-delete
 * grace period has passed.
 */
const PURGE_INTERVAL_MS = 12 * 60 * 60 * 1000

/**
 * Permanently deletes expired soft-deleted accounts: once on boot and
 * then every 12 hours while the server runs. Registered for the web
 * environment only (see adonisrc.ts); `node ace accounts:purge` covers
 * one-off/cron runs.
 */
export default class AccountPurgeProvider {
  #timer?: NodeJS.Timeout

  constructor(protected app: ApplicationService) {}

  async ready() {
    const { purgeExpiredAccounts } = await import('#services/account_deletion_service')
    const logger = await this.app.container.make('logger')

    const runPurge = async () => {
      try {
        const purged = await purgeExpiredAccounts()
        if (purged > 0) {
          logger.info(`account purge: permanently deleted ${purged} account(s)`)
        }
      } catch (error) {
        logger.error({ err: error }, 'account purge failed')
      }
    }

    await runPurge()
    this.#timer = setInterval(() => void runPurge(), PURGE_INTERVAL_MS)
    // The sweep must never keep a stopping process alive
    this.#timer.unref()
  }

  async shutdown() {
    if (this.#timer) {
      clearInterval(this.#timer)
    }
  }
}
