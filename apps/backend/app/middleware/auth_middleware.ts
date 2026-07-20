import { Exception } from '@adonisjs/core/exceptions'
import { isBanned } from '#services/role_service'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { Authenticators } from '@adonisjs/auth/types'

/**
 * Auth middleware is used authenticate HTTP requests and deny
 * access to unauthenticated users.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[]
    } = {}
  ) {
    const user = await ctx.auth.authenticateUsing(options.guards)

    // Banning revokes the user's tokens, so this is a backstop for a
    // token that outlives the ban (e.g. a ban applied out of band).
    if (isBanned(user)) {
      throw new Exception('Your account has been banned', {
        status: 403,
        code: 'E_ACCOUNT_BANNED',
      })
    }

    return next()
  }
}
