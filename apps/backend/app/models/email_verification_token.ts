import { EmailVerificationTokenSchema } from '#database/schema'

/**
 * A single-use, expiring email verification token (AUDIT.md G1).
 *
 * `tokenHash` is a SHA-256 hash of the value that went out in the email,
 * never the value itself. Redemption and issuing both live in
 * #services/email_verification_service; nothing else should write here.
 */
export default class EmailVerificationToken extends EmailVerificationTokenSchema {}
