import db from '@adonisjs/lucid/services/db'
import ModerationAction from '#models/moderation_action'
import type User from '#models/user'
import { recentMessagesByUser } from '#services/chat_search_service'
import { isOnline } from '#services/presence_service'
import { moderationActionShape } from '#transformers/moderation_action_transformer'
import { moderationUserShape } from '#transformers/moderation_user_transformer'
import type { AdminChatMessage } from '#services/chat_search_service'

/**
 * Everything an admin needs about one account on a single screen, so a
 * ban or mute is decided on the record rather than on the one message
 * that happened to be reported: their play record, their chat, the
 * reports for and against them, and their moderation history.
 */

/** Chat lines shown in the dossier. */
const RECENT_MESSAGE_LIMIT = 15

/** Matches shown in the dossier. */
const RECENT_MATCH_LIMIT = 10

/** Audit entries shown in each direction. */
const AUDIT_LIMIT = 25

/**
 * Reads a single aggregate cell as a number, since the drivers disagree
 * about whether counts come back as numbers or strings.
 */
function toCount(value: unknown): number {
  return Number(value ?? 0)
}

/** The user's record in recorded matches, split by game kind. */
async function playRecord(userId: number) {
  const rows = await db
    .from('match_players')
    .join('matches', 'matches.id', 'match_players.match_id')
    .where('match_players.user_id', userId)
    .groupBy('matches.kind')
    .select('matches.kind as kind')
    .count('* as played')
    .select(db.raw('sum(case when match_players.placement = 1 then 1 else 0 end) as wins'))
    .select(db.raw('sum(case when match_players.left_early then 1 else 0 end) as abandoned'))

  const byKind = new Map(
    rows.map((row) => [
      String(row.kind),
      {
        played: toCount(row.played),
        wins: toCount(row.wins),
        abandoned: toCount(row.abandoned),
      },
    ])
  )
  const empty = { played: 0, wins: 0, abandoned: 0 }
  const publicRecord = byKind.get('public') ?? empty
  const privateRecord = byKind.get('private') ?? empty
  const practiceRecord = byKind.get('practice') ?? empty

  return {
    publicMatches: publicRecord,
    privateMatches: privateRecord,
    practiceMatches: practiceRecord,
    publicWinRate:
      publicRecord.played === 0
        ? 0
        : Math.round((publicRecord.wins / publicRecord.played) * 1000) / 1000,
  }
}

/** The user's most recent recorded matches. */
async function recentMatches(userId: number) {
  const rows = await db
    .from('match_players')
    .join('matches', 'matches.id', 'match_players.match_id')
    .where('match_players.user_id', userId)
    .orderBy('matches.ended_at', 'desc')
    .limit(RECENT_MATCH_LIMIT)
    .select(
      'matches.id as id',
      'matches.kind as kind',
      'matches.completed as completed',
      'matches.ended_at as endedAt',
      'match_players.placement as placement',
      'match_players.final_score as finalScore',
      'match_players.left_early as leftEarly'
    )

  return rows.map((row) => ({
    id: Number(row.id),
    kind: String(row.kind),
    completed: Boolean(row.completed),
    endedAt: row.endedAt === null ? null : String(row.endedAt),
    placement: toCount(row.placement),
    finalScore: toCount(row.finalScore),
    leftEarly: Boolean(row.leftEarly),
  }))
}

/** How much trouble the user's chat has caused, and how much they report. */
async function reportRecord(userId: number) {
  const [againstRows, filedRows, chatRows] = await Promise.all([
    db
      .from('message_reports as mr')
      .join('chat_messages as cm', 'cm.id', 'mr.message_id')
      .where('cm.user_id', userId)
      .count('mr.id as total')
      .countDistinct('mr.message_id as messages')
      .select(db.raw('sum(case when mr.resolved_at is null then 1 else 0 end) as open'))
      .select(db.raw("sum(case when mr.outcome = 'actioned' then 1 else 0 end) as actioned")),
    db.from('message_reports').where('reporter_id', userId).count('* as total'),
    db
      .from('chat_messages')
      .where('user_id', userId)
      .count('* as total')
      .select(db.raw('sum(case when was_censored then 1 else 0 end) as censored'))
      .select(db.raw('sum(case when deleted_at is not null then 1 else 0 end) as deleted')),
  ])

  return {
    reportsAgainst: toCount(againstRows[0]?.total),
    reportedMessages: toCount(againstRows[0]?.messages),
    openReportsAgainst: toCount(againstRows[0]?.open),
    actionedReportsAgainst: toCount(againstRows[0]?.actioned),
    reportsFiled: toCount(filedRows[0]?.total),
    messagesPosted: toCount(chatRows[0]?.total),
    messagesCensored: toCount(chatRows[0]?.censored),
    messagesDeleted: toCount(chatRows[0]?.deleted),
  }
}

/** Friend and group counts, for a sense of how connected the account is. */
async function socialRecord(userId: number) {
  const [friendRows, groupRows] = await Promise.all([
    db
      .from('friendships')
      .where((builder) => builder.where('user_a_id', userId).orWhere('user_b_id', userId))
      .count('* as total'),
    db.from('group_members').where('user_id', userId).count('* as total'),
  ])

  return {
    friends: toCount(friendRows[0]?.total),
    groups: toCount(groupRows[0]?.total),
  }
}

export type UserDossier = {
  user: ReturnType<typeof moderationUserShape>
  isOnline: boolean
  play: Awaited<ReturnType<typeof playRecord>>
  recentMatches: Awaited<ReturnType<typeof recentMatches>>
  reports: Awaited<ReturnType<typeof reportRecord>>
  social: Awaited<ReturnType<typeof socialRecord>>
  recentMessages: AdminChatMessage[]
  /** Moderation taken against this account. */
  actionsReceived: ReturnType<typeof moderationActionShape>[]
  /** Moderation this account took, when they are a moderator or admin. */
  actionsTaken: ReturnType<typeof moderationActionShape>[]
}

/**
 * Assembles the full dossier for one account.
 */
export async function buildUserDossier(user: User): Promise<UserDossier> {
  const [play, matches, reports, social, messages, received, taken] = await Promise.all([
    playRecord(user.id),
    recentMatches(user.id),
    reportRecord(user.id),
    socialRecord(user.id),
    recentMessagesByUser(user.id, RECENT_MESSAGE_LIMIT),
    ModerationAction.query()
      .where('targetUserId', user.id)
      .orderBy('createdAt', 'desc')
      .limit(AUDIT_LIMIT),
    ModerationAction.query()
      .where('actorId', user.id)
      .orderBy('createdAt', 'desc')
      .limit(AUDIT_LIMIT),
  ])

  return {
    user: moderationUserShape(user),
    isOnline: isOnline(user.id),
    play,
    recentMatches: matches,
    reports,
    social,
    recentMessages: messages,
    actionsReceived: received.map(moderationActionShape),
    actionsTaken: taken.map(moderationActionShape),
  }
}
