import User from '#models/user'
import { signupValidator } from '#validators/user'
import { mintAccessToken } from '#services/access_token_service'
import UserTransformer from '#transformers/user_transformer'
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  /**
   * Creates a new account from email + unique username + password. In
   * development the account is active immediately; in production it
   * must verify its email first.
   */
  async store({ request, serialize }: HttpContext) {
    const { username, email, password } = await request.validateUsing(signupValidator)

    const user = await User.create({ username, email, password })

    // Email verification is enforced in production only (docs/features.md).
    // TODO: send the verification email once a mail transport is wired up.
    if (app.inProduction) {
      return serialize({
        user: UserTransformer.transform(user),
        token: null,
        requiresEmailVerification: true,
      })
    }

    return serialize({
      user: UserTransformer.transform(user),
      token: await mintAccessToken(user),
      requiresEmailVerification: false,
    })
  }
}
