import { DateTime } from 'luxon'
import User from '#models/user'

/**
 * How long a soft-deleted account is kept before it is permanently
 * removed. Signing back in during this window restores the account
 * (docs/features.md, User Accounts).
 */
export const ACCOUNT_RETENTION_DAYS = 30

/**
 * Soft-deletes an account: marks it as deleted and revokes every access
 * token so no session (on any device) can keep using it. The row is
 * kept for the grace period so the user can change their mind.
 */
export async function softDeleteAccount(user: User): Promise<void> {
  user.deletedAt = DateTime.now()
  await user.save()

  const tokens = await User.accessTokens.all(user)
  for (const token of tokens) {
    await User.accessTokens.delete(user, token.identifier)
  }
}

/**
 * Whether a soft-deleted account is still inside the grace period and
 * can be restored by signing in.
 */
export function isWithinRestoreWindow(user: User): boolean {
  return (
    user.deletedAt !== null &&
    user.deletedAt > DateTime.now().minus({ days: ACCOUNT_RETENTION_DAYS })
  )
}

/**
 * Permanently deletes every account whose grace period has passed and
 * returns how many were removed. Related rows (friendships, messages,
 * group memberships, tokens, ...) are removed by the ON DELETE rules
 * declared in the migrations.
 */
export async function purgeExpiredAccounts(): Promise<number> {
  const cutoff = DateTime.now().minus({ days: ACCOUNT_RETENTION_DAYS })
  const softDeleted = await User.query().whereNotNull('deleted_at')

  let purged = 0
  for (const user of softDeleted) {
    if (user.deletedAt === null || user.deletedAt > cutoff) {
      continue
    }
    await user.delete()
    purged++
  }
  return purged
}
