import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import User from '#models/user'
import EmailVerificationToken from '#models/email_verification_token'
import VerifyEmailNotification from '#mails/verify_email_notification'

/**
 * Issuing and redeeming email verification tokens (AUDIT.md G1).
 *
 * Production signup mints a token here and mails a link carrying it;
 * login refuses the account until it is redeemed
 * (`access_tokens_controller`). Verification is enforced in production
 * only, matching docs/features.md, so in development this still issues
 * tokens but logs the link instead of sending mail.
 *
 * The three properties the audit called for:
 *  - **Unguessable.** 32 bytes from the CSPRNG, base64url encoded.
 *  - **Single use.** Redemption claims the row with a conditional
 *    update, so two concurrent requests cannot both succeed.
 *  - **Expiring.** 24 hours, enforced in the same conditional update.
 */

/** 256 bits of entropy, which is not brute-forceable. */
const TOKEN_BYTES = 32

/** Long enough to survive a slow inbox, short enough to limit exposure. */
const TOKEN_TTL_HOURS = 24

/**
 * SHA-256 of the raw token, hex encoded.
 *
 * A plain hash rather than a password KDF on purpose: the input is
 * already 256 bits of CSPRNG output, so there is no dictionary to
 * stretch against, and verification happens on a user-facing request.
 */
function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * The player-facing site, which is where verification links point. The
 * API and the site are separate origins in the deployed setup, so this
 * is not `APP_URL`; it falls back to it only for a same-origin install.
 */
function frontendUrl(): string {
  return env.get('FRONTEND_URL') ?? env.get('APP_URL')
}

/**
 * The link mailed to the user.
 */
export function verificationUrl(rawToken: string): string {
  const base = frontendUrl().replace(/\/+$/, '')
  return `${base}/verify-email?token=${encodeURIComponent(rawToken)}`
}

/**
 * Mints a token for the user, invalidating any outstanding ones.
 *
 * Old tokens are dropped rather than left to expire so that a resend
 * cannot leave several live links for one address: the newest email is
 * the only one that works, which is what a user retrying a signup
 * expects.
 *
 * @returns the raw token, which is never persisted and cannot be
 *   recovered after this call.
 */
export async function issueVerificationToken(user: User): Promise<string> {
  await EmailVerificationToken.query().where('userId', user.id).delete()

  const rawToken = randomBytes(TOKEN_BYTES).toString('base64url')

  await EmailVerificationToken.create({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: DateTime.now().plus({ hours: TOKEN_TTL_HOURS }),
    usedAt: null,
  })

  return rawToken
}

/**
 * Issues a token and delivers the link.
 *
 * Outside production, where verification is not enforced, the link is
 * logged rather than mailed so local signups need no mail provider.
 *
 * @throws Error when the provider rejects the message, so callers can
 *   tell the user to retry rather than leaving them waiting for an
 *   email that was never accepted.
 */
export async function sendVerificationEmail(user: User): Promise<void> {
  const rawToken = await issueVerificationToken(user)
  const url = verificationUrl(rawToken)

  if (!env.get('RESEND_API_KEY')) {
    if (app.inProduction) {
      throw new Error(
        'RESEND_API_KEY is not set, so the verification email cannot be sent and the account cannot be used. Set it on the API service.'
      )
    }

    logger.info(`Email verification link for ${user.email}: ${url}`)
    return
  }

  await mail.send(new VerifyEmailNotification(user, url, TOKEN_TTL_HOURS))
}

/**
 * Normalises the assorted shapes Lucid's `update()` returns across
 * drivers (a row count, or an array of them) to a single count.
 */
function claimedRowCount(result: number | number[] | unknown): number {
  if (typeof result === 'number') {
    return result
  }
  if (Array.isArray(result) && typeof result[0] === 'number') {
    return result[0]
  }
  return 0
}

/**
 * Redeems a raw token and marks its user verified.
 *
 * @returns the verified user, or null when the token is unknown,
 *   already used, or expired. The three are deliberately
 *   indistinguishable to the caller so the endpoint cannot be used to
 *   probe which tokens exist.
 */
export async function redeemVerificationToken(rawToken: string): Promise<User | null> {
  if (rawToken.trim() === '') {
    return null
  }

  const now = DateTime.now()
  const nowSql = now.toSQL()

  // `DateTime.now()` is always a valid instant, so this cannot actually
  // be null. Checked rather than asserted because the conventions rule
  // out non-null assertions, and a wrong guess here would compare
  // against "null" as a string and silently redeem expired tokens.
  if (nowSql === null) {
    return null
  }

  // Claim the row and read it back only if this request is the one that
  // claimed it. Doing it as a single conditional update is what makes
  // the token single-use under concurrency: a second request matches
  // zero rows because `used_at` is no longer null.
  const claimed = await EmailVerificationToken.query()
    .where('tokenHash', hashToken(rawToken))
    .whereNull('usedAt')
    .where('expiresAt', '>', nowSql)
    .update({ usedAt: nowSql })

  if (claimedRowCount(claimed) === 0) {
    return null
  }

  const token = await EmailVerificationToken.query().where('tokenHash', hashToken(rawToken)).first()

  if (!token) {
    return null
  }

  const user = await User.find(token.userId)
  if (!user) {
    return null
  }

  // Re-verifying an already verified account is a no-op rather than an
  // error: the user clicked an old link, and telling them it failed
  // would be both confusing and a status oracle.
  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = now
    await user.save()
  }

  return user
}

/**
 * Finds the account a resend request refers to, if any.
 *
 * Callers must not vary their response on the outcome: the endpoint is
 * unauthenticated, so a distinguishable "no such account" would confirm
 * which addresses are registered (AUDIT.md S7).
 */
export async function findUnverifiedUserByEmail(email: string): Promise<User | null> {
  const user = await User.query().whereRaw('lower(email) = ?', [email.trim().toLowerCase()]).first()

  if (!user || user.emailVerifiedAt) {
    return null
  }

  return user
}
