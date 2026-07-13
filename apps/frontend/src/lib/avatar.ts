import { createAvatar } from '@dicebear/core'
import { bottts } from '@dicebear/collection'

/**
 * Avatars are DiceBear "bottts" robots generated deterministically from
 * the username, so every user has a consistent, recognisable icon
 * without uploading a photo (see docs/Frontend-design.md).
 */

/**
 * Background colours a robot is placed on. DiceBear picks one from the
 * seed, so a given username always gets the same robot and backdrop.
 */
const AVATAR_BACKGROUNDS = ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf']

/**
 * Data URIs keyed by seed, so repeat renders of the same username
 * (player lists, chat) reuse the SVG instead of rebuilding it.
 */
const avatarCache = new Map<string, string>()

/**
 * A deterministic bottts robot avatar for a username, as an SVG data
 * URI suitable for an <img src>. The username is the seed, so the same
 * user always resolves to the same robot on the server and the client.
 */
export function botttsAvatarUri(seed: string): string {
  const cached = avatarCache.get(seed)
  if (cached !== undefined) {
    return cached
  }

  const uri = createAvatar(bottts, {
    seed,
    backgroundColor: AVATAR_BACKGROUNDS,
  }).toDataUri()

  avatarCache.set(seed, uri)
  return uri
}
