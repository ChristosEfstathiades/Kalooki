import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import User from '#models/user'
import type { PlayerIdentity } from '#services/game/match_service'

/**
 * The bot accounts practice matches play with. Bots are ordinary user
 * rows (match history references them like any player) flagged with
 * `isBot`: they can never sign in — their password is a discarded
 * random secret — and they are excluded from friend requests and group
 * invites. The same bot may sit in any number of concurrent practice
 * matches; bots are never registered in the per-user match index.
 */

/** Usernames of the practice opponents, in seating-preference order. */
const BOT_USERNAMES = ['RustyBot', 'SparkBot', 'ZippyBot'] as const

/** The most bot opponents a practice match may have. */
export const MAX_BOT_OPPONENTS = BOT_USERNAMES.length

/**
 * Finds or creates the first `count` bot accounts and returns their
 * identities. If a human claimed a bot's name before this feature
 * existed, a numbered variant is used instead.
 */
export async function ensureBotUsers(count: number): Promise<PlayerIdentity[]> {
  const identities: PlayerIdentity[] = []
  for (const username of BOT_USERNAMES.slice(0, count)) {
    identities.push(await ensureBotUser(username))
  }
  return identities
}

/**
 * Finds or creates one bot account, stepping to numbered fallback
 * names when a non-bot user already owns the name.
 */
async function ensureBotUser(baseUsername: string): Promise<PlayerIdentity> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const username = attempt === 0 ? baseUsername : `${baseUsername}${attempt + 1}`
    const existing = await User.query()
      .whereRaw('LOWER(username) = ?', [username.toLowerCase()])
      .first()

    if (existing) {
      if (existing.isBot) {
        return { id: existing.id, username: existing.username }
      }
      continue
    }

    try {
      const bot = await User.create({
        username,
        email: `${username.toLowerCase()}@bots.kalooki.invalid`,
        password: randomUUID(),
        isBot: true,
        emailVerifiedAt: DateTime.now(),
      })
      return { id: bot.id, username: bot.username }
    } catch {
      // Lost a race with a concurrent create — re-check this name
      const raced = await User.query()
        .whereRaw('LOWER(username) = ?', [username.toLowerCase()])
        .first()
      if (raced?.isBot) {
        return { id: raced.id, username: raced.username }
      }
    }
  }
  throw new Error(`Could not provision a bot account for "${baseUsername}"`)
}
