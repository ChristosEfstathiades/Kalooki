import {
  findUnverifiedUserByEmail,
  redeemVerificationToken,
  sendVerificationEmail,
} from '#services/email_verification_service'
import { resendVerificationValidator, verifyEmailValidator } from '#validators/user'
import { mintAccessToken } from '#services/access_token_service'
import { isWithinRestoreWindow } from '#services/account_deletion_service'
import { isBanned } from '#services/role_service'
import UserTransformer from '#transformers/user_transformer'
import logger from '@adonisjs/core/services/logger'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class EmailVerificationController {
  /**
   * Redeems a verification link (AUDIT.md G1).
   *
   * On success the user is signed in immediately: they have just proved
   * control of the address, and bouncing them to a login form to type a
   * password they set sixty seconds ago is friction for no security. A
   * token is withheld only when the account cannot sign in anyway.
   */
  async verify({ request, serialize }: HttpContext) {
    const { token } = await request.validateUsing(verifyEmailValidator)

    const user = await redeemVerificationToken(token)

    if (!user) {
      // Unknown, expired and already-used tokens are one error on
      // purpose: distinguishing them would let anyone probe which
      // tokens exist.
      throw new Exception('This verification link is invalid or has expired.', {
        status: 400,
        code: 'E_INVALID_VERIFICATION_TOKEN',
      })
    }

    // The address is verified either way; these only decide whether we
    // hand out a session with it.
    const canSignIn = !isBanned(user) && (!user.deletedAt || isWithinRestoreWindow(user))

    return serialize({
      user: UserTransformer.transform(user),
      token: canSignIn ? await mintAccessToken(user) : null,
    })
  }

  /**
   * Sends another verification email.
   *
   * Always reports the same thing regardless of whether the address is
   * registered, unregistered, or already verified. The endpoint is
   * unauthenticated, so a response that varied would confirm which
   * addresses hold accounts (AUDIT.md S7). Rate limited by the auth
   * throttle it is grouped under.
   */
  async resend({ request, serialize }: HttpContext) {
    const { email } = await request.validateUsing(resendVerificationValidator)

    const user = await findUnverifiedUserByEmail(email)

    if (user) {
      try {
        await sendVerificationEmail(user)
      } catch (error) {
        // Swallowed so a provider outage cannot be used to probe which
        // addresses exist, and logged so it is still visible to us.
        logger.error({ err: error, userId: user.id }, 'Failed to send verification email')
      }
    }

    return serialize({
      message:
        'If that address has an account awaiting verification, a new link is on its way. Check your spam folder if it does not arrive.',
    })
  }
}
