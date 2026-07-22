import { collectAdminMetrics } from '#services/admin_metrics_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * The overview page's numbers on admin.{domain}: the size of the site,
 * the last day and week, and what the game service is doing right now.
 */
export default class AdminMetricsController {
  /**
   * Every dashboard figure in one response, so the overview needs a
   * single round trip rather than one per tile.
   */
  async index({ serialize }: HttpContext) {
    return serialize(await collectAdminMetrics())
  }
}
