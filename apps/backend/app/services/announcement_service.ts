import { DateTime } from 'luxon'
import { recordAction } from '#services/moderation_service'
import {
  broadcastAnnouncement,
  broadcastGlobalSystemMessage,
  broadcastSiteFlags,
} from '#services/socket_service'
import {
  clearAnnouncement,
  getAnnouncement,
  setAnnouncement,
  updateSiteFlags,
} from '#services/site_settings_service'
import type User from '#models/user'
import type { Announcement, AnnouncementTone, SiteFlags } from '#services/site_settings_service'

/**
 * Admin announcements: the site-wide banner and, optionally, a matching
 * line pushed into the global chatroom.
 *
 * The banner is stored so anyone who loads the site afterwards still
 * sees it; the chat line is live-only, since a stored system message
 * could be reported and moderated like a player's. Both go out over the
 * socket so a notice lands without anyone reloading.
 */

export interface AnnouncementInput {
  body: string
  tone: AnnouncementTone
  /** Minutes the banner stays up; null keeps it until cleared. */
  durationMinutes: number | null
  /** Also post the text as a system line in the global chatroom. */
  alsoPostToChat: boolean
}

/**
 * Raises the banner, optionally announcing it in the global chat too.
 */
export async function publishAnnouncement(
  actor: User,
  input: AnnouncementInput
): Promise<Announcement> {
  const expiresAt =
    input.durationMinutes === null ? null : DateTime.now().plus({ minutes: input.durationMinutes })

  const announcement = await setAnnouncement(actor, {
    body: input.body,
    tone: input.tone,
    expiresAt,
  })

  broadcastAnnouncement(announcement)
  if (input.alsoPostToChat) {
    broadcastGlobalSystemMessage(input.body)
  }

  await recordAction({
    action: 'site.announce',
    actor,
    details: {
      tone: input.tone,
      durationMinutes: input.durationMinutes,
      postedToChat: input.alsoPostToChat,
      body: input.body,
    },
  })

  return announcement
}

/**
 * Takes the banner down for everyone immediately.
 */
export async function withdrawAnnouncement(actor: User): Promise<void> {
  await clearAnnouncement(actor)
  broadcastAnnouncement(null)
  await recordAction({ action: 'site.announce.clear', actor })
}

/**
 * Posts a one-off system line into the global chatroom without touching
 * the banner, for a short notice that does not need to persist.
 */
export async function postGlobalNotice(actor: User, body: string): Promise<void> {
  broadcastGlobalSystemMessage(body)
  await recordAction({ action: 'site.announce', actor, details: { chatOnly: true, body } })
}

/**
 * Applies a change to the operational switches, tells every connected
 * client, and records what changed.
 */
export async function applySiteFlags(actor: User, changes: Partial<SiteFlags>): Promise<SiteFlags> {
  const flags = await updateSiteFlags(actor, changes)
  broadcastSiteFlags(flags)

  await recordAction({ action: 'site.flags', actor, details: { changed: changes } })
  return flags
}

/**
 * The banner as the player site reads it, or null when nothing is up.
 */
export async function currentAnnouncement(): Promise<Announcement | null> {
  return getAnnouncement()
}
