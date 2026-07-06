import User from '#models/user'
import { loginValidator } from '#validators/user'
import { mintAccessToken } from '#services/access_token_service'
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
    const { email, password, rememberMe } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)

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
