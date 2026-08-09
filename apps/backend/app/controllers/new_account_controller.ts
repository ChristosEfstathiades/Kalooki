import User from '#models/user'
import { signupValidator } from '#validators/user'
import { mintAccessToken } from '#services/access_token_service'
import { getSiteFlags } from '#services/site_settings_service'
import { sendVerificationEmail } from '#services/email_verification_service'
import UserTransformer from '#transformers/user_transformer'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  /**
   * Creates a new account from email + unique username + password. In
   * development the account is active immediately; in production it
   * must verify its email first. Refused outright while an admin has
   * signups switched off.
   */
  async store({ request, serialize }: HttpContext) {
    const { signupsEnabled } = await getSiteFlags()
    if (!signupsEnabled) {
      throw new Exception('New accounts are temporarily closed. Please try again later.', {
        status: 503,
        code: 'E_SIGNUPS_DISABLED',
      })
    }

    const { username, email, password } = await request.validateUsing(signupValidator)

    const user = await User.create({ username, email, password })

    // Email verification is enforced in production only (docs/features.md).
    if (app.inProduction) {
      let emailSent = true

      try {
        await sendVerificationEmail(user)
      } catch (error) {
        // The account exists and the password is set; only delivery
        // failed. Keeping the account and pointing the user at the
        // resend endpoint is better than rolling the signup back and
        // making them retype everything (AUDIT.md G1).
        emailSent = false
        logger.error({ err: error, userId: user.id }, 'Failed to send verification email at signup')
      }

      return serialize({
        user: UserTransformer.transform(user),
        token: null,
        requiresEmailVerification: true,
        emailSent,
      })
    }

    // Same shape as the production branch: a response whose keys vary by
    // environment turns into a union in the generated client and makes
    // every consumer narrow it for no reason.
    return serialize({
      user: UserTransformer.transform(user),
      token: await mintAccessToken(user),
      requiresEmailVerification: false,
      emailSent: false,
    })
  }
}
