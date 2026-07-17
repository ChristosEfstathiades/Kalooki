import User from '#models/user'
import { loginValidator } from '#validators/user'
import { failedLoginAttemptsLimiter } from '#start/limiter'
import { mintAccessToken } from '#services/access_token_service'
import { isWithinRestoreWindow } from '#services/account_deletion_service'
import UserTransformer from '#transformers/user_transformer'
import app from '@adonisjs/core/services/app'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class AccessTokensController {
  /**
   * Signs a user in: verifies credentials and mints an access token.
   * "Remember me" extends the token lifetime.
   */
  async store({ request, serialize }: HttpContext) {
    const { identifier, password, rememberMe } = await request.validateUsing(loginValidator)

    // Failed attempts for the same account from the same IP feed a
    // lockout counter; a successful login resets it (AUDIT.md S1).
    const attemptKey = `login_${identifier.toLowerCase()}_${request.ip()}`
    const [throttleError, user] = await failedLoginAttemptsLimiter().penalize(attemptKey, () => {
      return User.verifyCredentials(identifier, password)
    })
    if (throttleError) {
      throw throttleError.setMessage(
        'Too many failed login attempts. Please try again in 15 minutes.'
      )
    }

    if (user.deletedAt) {
      // Past the grace period the account is as good as gone (the purge
      // job just hasn't run yet), so report plain invalid credentials.
      if (!isWithinRestoreWindow(user)) {
        throw new Exception('Invalid user credentials', {
          status: 400,
          code: 'E_INVALID_CREDENTIALS',
        })
      }
      // Signing in during the grace period restores the account.
      user.deletedAt = null
      await user.save()
    }

    // Email verification is enforced in production only (docs/features.md).
    if (app.inProduction && !user.emailVerifiedAt) {
      throw new Exception('Please verify your email address before signing in', {
        status: 403,
        code: 'E_EMAIL_NOT_VERIFIED',
      })
    }

    return serialize({
      user: UserTransformer.transform(user),
      token: await mintAccessToken(user, { rememberMe }),
    })
  }

  /**
   * Signs the user out by revoking the access token used on this request.
   */
  async destroy({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    if (user.currentAccessToken) {
      await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    }

    return serialize({ message: 'Logged out successfully' })
  }
}
