import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import ChatMessage from '#models/chat_message'
import MessageReport from '#models/message_report'
import User from '#models/user'
import { recordAction } from '#services/moderation_service'
import { isBanned, isMuted } from '#services/role_service'
import type { ReportOutcome } from '#models/message_report'

/**
 * The message report queue behind the admin app. Reports arrive one per
 * reporter (see ChatMessagesController.report), but they are reviewed
 * per message: an admin looks at one offending line and decides once,
 * which closes every open report against it.
 *
 * The aggregates are written as query-builder calls rather than loaded
 * models because the queue sorts by counts across the whole table, and
 * pulling every report into memory to do that would not survive a busy
 * chatroom.
 */

/** Which slice of the queue to show. */
export type ReportStatusFilter = 'open' | 'resolved' | 'all'

/** How the queue is ordered. */
export type ReportSort = 'recent' | 'oldest' | 'most-reported'

/** Chat channels a report can come from. */
export type ReportChannelFilter = 'global' | 'group' | 'match' | 'all'

export interface ReportQueueFilters {
  page: number
  perPage: number
  status: ReportStatusFilter
  sort: ReportSort
  channel: ReportChannelFilter
  /** Matches the message body or the author's username. */
  search: string | null
}

/** Reports remaining open before a message is treated as unhandled. */
const OPEN_REPORTS_EXPRESSION = 'sum(case when mr.resolved_at is null then 1 else 0 end)'

/**
 * One reporter's submission against a message.
 */
function reporterShape(report: MessageReport) {
  // Lucid types a belongsTo as always present, but an unresolved
  // relation (a purged reporter, an open report with no resolver) is
  // undefined at runtime — so widen before reading through it.
  const reporter = report.reporter as User | undefined
  const resolver = report.resolver as User | undefined

  return {
    id: report.id,
    reporterId: report.reporterId,
    reporterUsername: reporter?.username ?? null,
    createdAt: report.createdAt.toISO(),
    resolvedAt: report.resolvedAt?.toISO() ?? null,
    resolvedByUsername: resolver?.username ?? null,
    outcome: report.outcome,
    resolutionNote: report.resolutionNote,
  }
}

/**
 * One row of the queue: the reported message, who wrote it, and the
 * reports standing against it.
 */
function queueEntryShape(input: {
  message: ChatMessage
  reports: MessageReport[]
  reportCount: number
  openCount: number
  firstReportedAt: string | null
  lastReportedAt: string | null
}) {
  const { message, reports } = input
  const author = message.user as User | undefined

  return {
    messageId: message.id,
    body: message.body,
    channel: message.channel,
    groupId: message.groupId,
    matchId: message.matchId,
    wasCensored: Boolean(message.wasCensored),
    postedAt: message.createdAt.toISO(),
    deletedAt: message.deletedAt?.toISO() ?? null,
    author: author
      ? {
          id: author.id,
          username: author.username,
          role: author.role,
          isBanned: isBanned(author),
          isMuted: isMuted(author),
        }
      : null,
    reportCount: input.reportCount,
    openCount: input.openCount,
    isResolved: input.openCount === 0,
    firstReportedAt: input.firstReportedAt,
    lastReportedAt: input.lastReportedAt,
    reports: reports.map(reporterShape),
  }
}

export type ReportQueueEntry = ReturnType<typeof queueEntryShape>

/**
 * Normalizes a timestamp coming back from a raw aggregate, which is an
 * ISO string on Postgres and a millisecond number on SQLite.
 */
function aggregateTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return DateTime.fromMillis(value).toISO()
  }
  if (value instanceof Date) {
    return DateTime.fromJSDate(value).toISO()
  }
  const parsed = DateTime.fromSQL(String(value))
  return parsed.isValid ? parsed.toISO() : String(value)
}

/**
 * The grouped reports query with every filter applied but no ordering
 * or paging, so the same shape can be counted and listed.
 */
function filteredReportGroups(filters: ReportQueueFilters) {
  const query = db
    .from('message_reports as mr')
    .join('chat_messages as cm', 'cm.id', 'mr.message_id')
    .join('users as author', 'author.id', 'cm.user_id')
    .groupBy('mr.message_id')

  if (filters.channel !== 'all') {
    query.where('cm.channel', filters.channel)
  }

  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`
    query.where((builder) => {
      builder
        .whereRaw('lower(cm.body) like ?', [term])
        .orWhereRaw('lower(author.username) like ?', [term])
    })
  }

  if (filters.status === 'open') {
    query.havingRaw(`${OPEN_REPORTS_EXPRESSION} > 0`)
  } else if (filters.status === 'resolved') {
    query.havingRaw(`${OPEN_REPORTS_EXPRESSION} = 0`)
  }

  return query
}

/**
 * Applies the chosen ordering. "Most reported" falls back to recency so
 * equally-reported messages still surface newest first.
 */
function applyReportSort(
  query: ReturnType<typeof filteredReportGroups>,
  sort: ReportSort
): ReturnType<typeof filteredReportGroups> {
  if (sort === 'oldest') {
    return query.orderByRaw('min(mr.created_at) asc')
  }
  if (sort === 'most-reported') {
    return query.orderByRaw('count(mr.id) desc').orderByRaw('max(mr.created_at) desc')
  }
  return query.orderByRaw('max(mr.created_at) desc')
}

type ReportQueuePage = {
  entries: ReportQueueEntry[]
  meta: { page: number; perPage: number; total: number; lastPage: number }
}

/**
 * One page of the report queue, newest/oldest/most-reported first.
 */
export async function listReportQueue(filters: ReportQueueFilters): Promise<ReportQueuePage> {
  const countRows = await db
    .from(filteredReportGroups(filters).select('mr.message_id').as('grouped'))
    .count('* as total')
  const total = Number(countRows[0]?.total ?? 0)

  const rows = await applyReportSort(filteredReportGroups(filters), filters.sort)
    .select('mr.message_id as messageId')
    .count('mr.id as reportCount')
    .select(db.raw(`${OPEN_REPORTS_EXPRESSION} as openCount`))
    .min('mr.created_at as firstReportedAt')
    .max('mr.created_at as lastReportedAt')
    .limit(filters.perPage)
    .offset((filters.page - 1) * filters.perPage)

  const messageIds = rows.map((row) => Number(row.messageId))
  const lastPage = Math.max(1, Math.ceil(total / filters.perPage))
  if (messageIds.length === 0) {
    return { entries: [], meta: { page: filters.page, perPage: filters.perPage, total, lastPage } }
  }

  const messages = await ChatMessage.query().whereIn('id', messageIds).preload('user')
  const messagesById = new Map(messages.map((message) => [message.id, message]))

  const reports = await MessageReport.query()
    .whereIn('messageId', messageIds)
    .orderBy('createdAt', 'asc')
    .preload('reporter')
    .preload('resolver')
  const reportsByMessage = new Map<number, MessageReport[]>()
  for (const report of reports) {
    const existing = reportsByMessage.get(report.messageId)
    if (existing) {
      existing.push(report)
    } else {
      reportsByMessage.set(report.messageId, [report])
    }
  }

  const entries = rows
    .map((row): ReportQueueEntry | null => {
      const message = messagesById.get(Number(row.messageId))
      if (!message) {
        return null
      }
      return queueEntryShape({
        message,
        reports: reportsByMessage.get(message.id) ?? [],
        reportCount: Number(row.reportCount),
        openCount: Number(row.openCount),
        firstReportedAt: aggregateTimestamp(row.firstReportedAt),
        lastReportedAt: aggregateTimestamp(row.lastReportedAt),
      })
    })
    .filter((entry): entry is ReportQueueEntry => entry !== null)

  return { entries, meta: { page: filters.page, perPage: filters.perPage, total, lastPage } }
}

/**
 * Authors whose messages draw the most reports, worst first. This is
 * the "who is actually causing trouble" view: a single ugly message is
 * one report, while a persistent offender shows up here.
 */
export async function listReportedAuthors(limit: number) {
  const rows = await db
    .from('message_reports as mr')
    .join('chat_messages as cm', 'cm.id', 'mr.message_id')
    .groupBy('cm.user_id')
    .select('cm.user_id as userId')
    .count('mr.id as totalReports')
    .countDistinct('mr.message_id as reportedMessages')
    .select(db.raw(`${OPEN_REPORTS_EXPRESSION} as openReports`))
    .max('mr.created_at as lastReportedAt')
    .orderByRaw('count(mr.id) desc')
    .orderByRaw('count(distinct mr.message_id) desc')
    .limit(limit)

  const userIds = rows.map((row) => Number(row.userId))
  if (userIds.length === 0) {
    return []
  }

  const users = await User.query().whereIn('id', userIds)
  const usersById = new Map(users.map((user) => [user.id, user]))

  return rows
    .map((row) => {
      const user = usersById.get(Number(row.userId))
      if (!user) {
        return null
      }
      return {
        userId: user.id,
        username: user.username,
        role: user.role,
        isBanned: isBanned(user),
        isMuted: isMuted(user),
        totalReports: Number(row.totalReports),
        reportedMessages: Number(row.reportedMessages),
        openReports: Number(row.openReports),
        lastReportedAt: aggregateTimestamp(row.lastReportedAt),
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
}

export type ReportedAuthor = Awaited<ReturnType<typeof listReportedAuthors>>[number]

/**
 * How many messages still have at least one unresolved report. Drives
 * the queue's badge in the admin sidebar.
 */
export async function openReportCount(): Promise<number> {
  const rows = await db
    .from('message_reports')
    .whereNull('resolved_at')
    .countDistinct('message_id as total')
  return Number(rows[0]?.total ?? 0)
}

/**
 * Closes every open report against one message, recording who decided
 * and why. Resolving is idempotent: a message whose reports are already
 * closed is left alone rather than treated as an error, so two admins
 * clearing the same row do not collide.
 *
 * @throws Exception (404) when no report exists for that message.
 */
export async function resolveReportsForMessage(
  actor: User,
  messageId: number,
  input: { outcome: ReportOutcome; note?: string | null }
): Promise<{ messageId: number; resolvedCount: number }> {
  const message = await ChatMessage.find(messageId)
  const open = await MessageReport.query().where('messageId', messageId).whereNull('resolvedAt')

  if (!message) {
    throw new Exception('Reported message not found', {
      status: 404,
      code: 'E_MESSAGE_NOT_FOUND',
    })
  }

  const resolvedAt = DateTime.now()
  for (const report of open) {
    report.resolvedAt = resolvedAt
    report.resolvedBy = actor.id
    report.outcome = input.outcome
    report.resolutionNote = input.note ?? null
    await report.save()
  }

  if (open.length > 0) {
    await recordAction({
      action: 'report.resolve',
      actor,
      message,
      target: await User.find(message.userId),
      reason: input.note,
      details: { outcome: input.outcome, reportsClosed: open.length },
    })
  }

  return { messageId, resolvedCount: open.length }
}

/**
 * Reopens every report against a message, for when a resolution turns
 * out to have been the wrong call.
 *
 * @throws Exception (404) when the message has no reports at all.
 */
export async function reopenReportsForMessage(
  messageId: number
): Promise<{ reopenedCount: number }> {
  const reports = await MessageReport.query().where('messageId', messageId)
  if (reports.length === 0) {
    throw new Exception('This message has no reports', {
      status: 404,
      code: 'E_REPORT_NOT_FOUND',
    })
  }

  let reopenedCount = 0
  for (const report of reports) {
    if (report.resolvedAt === null) {
      continue
    }
    report.resolvedAt = null
    report.resolvedBy = null
    report.outcome = null
    report.resolutionNote = null
    await report.save()
    reopenedCount += 1
  }

  return { reopenedCount }
}
