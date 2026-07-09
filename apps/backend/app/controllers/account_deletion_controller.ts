import { ACCOUNT_RETENTION_DAYS, softDeleteAccount } from '#services/account_deletion_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class AccountDeletionController {
  /**
   * Soft-deletes the signed-in user's account and revokes all of their
   * sessions. The account is permanently removed after the grace
   * period; signing back in before then restores it.
   */
  async destroy({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    await softDeleteAccount(user)

    return serialize({
      message: `Your account is scheduled for permanent deletion. Sign back in within ${ACCOUNT_RETENTION_DAYS} days to restore it.`,
    })
  }
}
