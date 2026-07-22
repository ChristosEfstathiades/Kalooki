import { currentAnnouncement } from '#services/announcement_service'
import { listPublishedNews, publicNewsShape } from '#services/news_service'
import { getSiteFlags } from '#services/site_settings_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Public, unauthenticated reads of admin-managed site content: the
 * news panel on the play page, the site-wide announcement banner, and
 * the operational switches the player site needs in order to hide
 * features an admin has turned off.
 *
 * The welcome page shows the banner before anyone signs in, so these
 * routes sit outside the auth middleware alongside the online count.
 */
export default class SiteController {
  /**
   * The banner and the feature switches, read on page load and kept
   * current afterwards by the site:announcement and site:flags socket
   * events.
   */
  async status({ serialize }: HttpContext) {
    const [flags, announcement] = await Promise.all([getSiteFlags(), currentAnnouncement()])
    return serialize({ flags, announcement })
  }

  /**
   * Published news items for the play page's news panel, pinned first
   * then newest. Drafts are never included.
   */
  async news({ serialize }: HttpContext) {
    const items = await listPublishedNews()
    return serialize({ news: items.map(publicNewsShape) })
  }
}
