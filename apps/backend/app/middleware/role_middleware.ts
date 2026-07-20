import { Exception } from '@adonisjs/core/exceptions'
import { hasAtLeastRole } from '#services/role_service'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { UserRole } from '#services/role_service'

/**
 * Restricts a route to users at or above an authorization level, e.g.
 * `middleware.role('moderator')`. Roles are hierarchical, so an admin
 * passes a moderator check. Must run after `middleware.auth()`, which
 * establishes the user.
 */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, minimum: UserRole) {
    const user = ctx.auth.getUserOrFail()

    if (!hasAtLeastRole(user, minimum)) {
      throw new Exception('You do not have permission to perform this action', {
        status: 403,
        code: 'E_INSUFFICIENT_ROLE',
      })
    }

    return next()
  }
}
