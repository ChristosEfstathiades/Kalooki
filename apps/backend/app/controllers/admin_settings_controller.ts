import {
  applySiteFlags,
  currentAnnouncement,
  postGlobalNotice,
  publishAnnouncement,
  withdrawAnnouncement,
} from '#services/announcement_service'
import { getSiteFlags } from '#services/site_settings_service'
import { announcementValidator, globalNoticeValidator, siteFlagsValidator } from '#validators/admin'
import type { HttpContext } from '@adonisjs/core/http'
import type { AnnouncementTone } from '#services/site_settings_service'

/**
 * Operational controls on admin.{domain}: the feature kill switches,
 * maintenance mode, and the site-wide announcement banner.
 */
export default class AdminSettingsController {
  /**
   * The current switches and banner, so the settings page renders what
   * is actually in force.
   */
  async show({ serialize }: HttpContext) {
    const [flags, announcement] = await Promise.all([getSiteFlags(), currentAnnouncement()])
    return serialize({ flags, announcement })
  }

  /**
   * Flips one or more switches. Only the flags named in the request
   * change; the rest are left as they are.
   */
  async updateFlags({ auth, request, serialize }: HttpContext) {
    const changes = await request.validateUsing(siteFlagsValidator)
    return serialize({ flags: await applySiteFlags(auth.getUserOrFail(), changes) })
  }

  /**
   * Raises the site-wide banner, optionally posting the same text as a
   * system line in the global chatroom.
   */
  async announce({ auth, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(announcementValidator)

    const announcement = await publishAnnouncement(auth.getUserOrFail(), {
      body: payload.body,
      tone: (payload.tone ?? 'info') as AnnouncementTone,
      durationMinutes: payload.durationMinutes ?? null,
      alsoPostToChat: payload.alsoPostToChat ?? false,
    })

    return serialize({ announcement })
  }

  /**
   * Takes the banner down for everyone immediately.
   */
  async clearAnnouncement({ auth, serialize }: HttpContext) {
    await withdrawAnnouncement(auth.getUserOrFail())
    return serialize({ announcement: null })
  }

  /**
   * Posts a one-off line into the global chatroom without raising the
   * banner. Live only — it is never stored, so it cannot be reported.
   */
  async notice({ auth, request, serialize }: HttpContext) {
    const { body } = await request.validateUsing(globalNoticeValidator)
    await postGlobalNotice(auth.getUserOrFail(), body)

    return serialize({ message: 'Posted to the global chatroom' })
  }
}
