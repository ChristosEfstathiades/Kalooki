import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { liveGameStats } from '#services/game/match_service'
import { onlineCount } from '#services/presence_service'
import type { LiveGameStats } from '#services/game/match_service'

/**
 * The numbers on the admin dashboard's overview: how big the site is,
 * what happened in the last day and week, and what is happening right
 * now. Everything here is a count, so it is read with the query builder
 * rather than hydrated models.
 */

/** Days of history the signup and match sparkline covers. */
const TREND_DAYS = 14

/**
 * Runs one count query and returns it as a number, since the drivers
 * disagree about whether a count comes back as a number or a string.
 */
async function countWhere(
  table: string,
  apply: (query: ReturnType<typeof db.from>) => ReturnType<typeof db.from>
): Promise<number> {
  const rows = await apply(db.from(table)).count('* as total')
  return Number(rows[0]?.total ?? 0)
}

/** Counts of the whole user base and its moderation state. */
async function userMetrics(dayAgo: DateTime, weekAgo: DateTime) {
  const [total, bots, newToday, newThisWeek, banned, muted, staff] = await Promise.all([
    countWhere('users', (query) => query.where('is_bot', false)),
    countWhere('users', (query) => query.where('is_bot', true)),
    countWhere('users', (query) =>
      query.where('is_bot', false).where('created_at', '>=', dayAgo.toSQL() ?? '')
    ),
    countWhere('users', (query) =>
      query.where('is_bot', false).where('created_at', '>=', weekAgo.toSQL() ?? '')
    ),
    countWhere('users', (query) => query.whereNotNull('banned_at')),
    countWhere('users', (query) =>
      query
        .whereNotNull('muted_at')
        .where((builder) =>
          builder.whereNull('muted_until').orWhere('muted_until', '>', DateTime.now().toSQL() ?? '')
        )
    ),
    countWhere('users', (query) => query.whereIn('role', ['moderator', 'admin'])),
  ])

  return { total, bots, newToday, newThisWeek, banned, muted, staff }
}

/** Counts of recorded matches. */
async function matchMetrics(dayAgo: DateTime, weekAgo: DateTime) {
  const [total, completedToday, completedThisWeek, publicTotal] = await Promise.all([
    countWhere('matches', (query) => query),
    countWhere('matches', (query) =>
      query.where('completed', true).where('ended_at', '>=', dayAgo.toSQL() ?? '')
    ),
    countWhere('matches', (query) =>
      query.where('completed', true).where('ended_at', '>=', weekAgo.toSQL() ?? '')
    ),
    countWhere('matches', (query) => query.where('kind', 'public').where('completed', true)),
  ])

  return { total, completedToday, completedThisWeek, publicCompleted: publicTotal }
}

/** Counts of chat traffic and its moderation. */
async function chatMetrics(dayAgo: DateTime, weekAgo: DateTime) {
  const [today, thisWeek, deleted, censored] = await Promise.all([
    countWhere('chat_messages', (query) => query.where('created_at', '>=', dayAgo.toSQL() ?? '')),
    countWhere('chat_messages', (query) => query.where('created_at', '>=', weekAgo.toSQL() ?? '')),
    countWhere('chat_messages', (query) => query.whereNotNull('deleted_at')),
    countWhere('chat_messages', (query) => query.where('was_censored', true)),
  ])

  return { today, thisWeek, deleted, censored }
}

/** Counts of the report queue's backlog and throughput. */
async function reportMetrics(dayAgo: DateTime) {
  const openRows = await db
    .from('message_reports')
    .whereNull('resolved_at')
    .countDistinct('message_id as total')
  const [total, resolvedToday, newToday] = await Promise.all([
    countWhere('message_reports', (query) => query),
    countWhere('message_reports', (query) =>
      query.whereNotNull('resolved_at').where('resolved_at', '>=', dayAgo.toSQL() ?? '')
    ),
    countWhere('message_reports', (query) => query.where('created_at', '>=', dayAgo.toSQL() ?? '')),
  ])

  return { open: Number(openRows[0]?.total ?? 0), total, resolvedToday, newToday }
}

/** One day of the overview's trend chart. */
export type DailyTrendPoint = {
  /** ISO date, e.g. 2026-07-22. */
  date: string
  signups: number
  matches: number
}

/**
 * Signups and completed matches per day over the trend window. Counted
 * in JavaScript from two narrow queries rather than with a per-driver
 * date_trunc, so SQLite and Postgres return the same buckets.
 */
async function dailyTrend(): Promise<DailyTrendPoint[]> {
  const since = DateTime.now()
    .minus({ days: TREND_DAYS - 1 })
    .startOf('day')
  const sinceSql = since.toSQL() ?? ''

  const [signupRows, matchRows] = await Promise.all([
    db
      .from('users')
      .where('is_bot', false)
      .where('created_at', '>=', sinceSql)
      .select('created_at as at'),
    db
      .from('matches')
      .where('completed', true)
      .where('ended_at', '>=', sinceSql)
      .select('ended_at as at'),
  ])

  const buckets = new Map<string, DailyTrendPoint>()
  for (let offset = 0; offset < TREND_DAYS; offset += 1) {
    const date = since.plus({ days: offset }).toISODate() ?? ''
    buckets.set(date, { date, signups: 0, matches: 0 })
  }

  const bucketFor = (value: unknown): DailyTrendPoint | undefined => {
    const parsed =
      value instanceof Date
        ? DateTime.fromJSDate(value)
        : typeof value === 'number'
          ? DateTime.fromMillis(value)
          : DateTime.fromSQL(String(value))
    return parsed.isValid ? buckets.get(parsed.toISODate() ?? '') : undefined
  }

  for (const row of signupRows) {
    const bucket = bucketFor(row.at)
    if (bucket) {
      bucket.signups += 1
    }
  }
  for (const row of matchRows) {
    const bucket = bucketFor(row.at)
    if (bucket) {
      bucket.matches += 1
    }
  }

  return [...buckets.values()]
}

export type AdminMetrics = {
  users: Awaited<ReturnType<typeof userMetrics>>
  matches: Awaited<ReturnType<typeof matchMetrics>>
  chat: Awaited<ReturnType<typeof chatMetrics>>
  reports: Awaited<ReturnType<typeof reportMetrics>>
  live: LiveGameStats & { playersOnline: number }
  trend: DailyTrendPoint[]
  generatedAt: string
}

/**
 * Everything the overview page shows, in one round trip.
 */
export async function collectAdminMetrics(): Promise<AdminMetrics> {
  const now = DateTime.now()
  const dayAgo = now.minus({ hours: 24 })
  const weekAgo = now.minus({ days: 7 })

  const [users, matches, chat, reports, trend] = await Promise.all([
    userMetrics(dayAgo, weekAgo),
    matchMetrics(dayAgo, weekAgo),
    chatMetrics(dayAgo, weekAgo),
    reportMetrics(dayAgo),
    dailyTrend(),
  ])

  return {
    users,
    matches,
    chat,
    reports,
    live: { ...liveGameStats(), playersOnline: onlineCount() },
    trend,
    generatedAt: now.toISO() ?? '',
  }
}
