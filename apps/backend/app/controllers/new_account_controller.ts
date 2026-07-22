import User from '#models/user'
import { signupValidator } from '#validators/user'
import { mintAccessToken } from '#services/access_token_service'
import { getSiteFlags } from '#services/site_settings_service'
import UserTransformer from '#transformers/user_transformer'
import app from '@adonisjs/core/services/app'
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
