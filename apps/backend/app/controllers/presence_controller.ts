import { onlineCount } from '#services/presence_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class PresenceController {
  /**
   * How many players are online right now. Read once on page load; the
   * socket server pushes `presence:count` after that, so this is only
   * the starting value.
   */
  async index({ serialize }: HttpContext) {
    return serialize({ online: onlineCount() })
  }
}
