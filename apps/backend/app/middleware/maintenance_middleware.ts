import { Exception } from '@adonisjs/core/exceptions'
import { hasAtLeastRole } from '#services/role_service'
import { getSiteFlags } from '#services/site_settings_service'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Closes the API to everyone but admins while maintenance mode is on,
 * so an admin can take the site down from admin.{domain} without a
 * deploy and still sign in to turn it back on.
 *
 * Runs globally, after silent_auth_middleware has populated the user
 * when a token is present. The admin routes themselves are exempt: they
 * are how maintenance mode gets lifted.
 */
export default class MaintenanceMiddleware {
  /** Path prefixes that keep working while the site is closed. */
  private static readonly EXEMPT_PREFIXES = ['/api/v1/admin', '/api/v1/auth', '/api/v1/account']

  async handle(ctx: HttpContext, next: NextFn) {
    const path = ctx.request.url()
    const exempt = MaintenanceMiddleware.EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))
    if (exempt) {
      return next()
    }

    const { maintenanceMode } = await getSiteFlags()
    if (!maintenanceMode) {
      return next()
    }

    const user = ctx.auth.user
    if (user && hasAtLeastRole(user, 'admin')) {
      return next()
    }

    throw new Exception('Kalooki Online is down for maintenance. Please try again shortly.', {
      status: 503,
      code: 'E_MAINTENANCE_MODE',
    })
  }
}
