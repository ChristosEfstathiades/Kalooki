import {
  listReportQueue,
  listReportedAuthors,
  openReportCount,
  reopenReportsForMessage,
  resolveReportsForMessage,
} from '#services/report_service'
import {
  listReportedAuthorsValidator,
  listReportsValidator,
  resolveReportValidator,
} from '#validators/admin'
import type { HttpContext } from '@adonisjs/core/http'
import type { ReportChannelFilter, ReportSort, ReportStatusFilter } from '#services/report_service'

/** Reported messages per page when the request does not say. */
const DEFAULT_PER_PAGE = 20

/** Authors returned by the offenders list when no limit is given. */
const DEFAULT_AUTHOR_LIMIT = 20

/**
 * The message report queue on admin.{domain}. Every route here is
 * behind `middleware.role('admin')`.
 *
 * Reports are filed per reporter but reviewed per message: one decision
 * closes every open report against the same line.
 */
export default class AdminReportsController {
  /**
   * One page of reported messages, ordered newest, oldest, or by how
   * many reports each has drawn.
   */
  async index({ request, serialize }: HttpContext) {
    const filters = await request.validateUsing(listReportsValidator, { data: request.qs() })

    const page = await listReportQueue({
      page: filters.page ?? 1,
      perPage: filters.perPage ?? DEFAULT_PER_PAGE,
      status: (filters.status ?? 'open') as ReportStatusFilter,
      sort: (filters.sort ?? 'recent') as ReportSort,
      channel: (filters.channel ?? 'all') as ReportChannelFilter,
      search: filters.search ?? null,
    })

    return serialize({ reports: page.entries, meta: page.meta })
  }

  /**
   * Authors whose messages draw the most reports, worst first, so a
   * persistent offender stands out from a single ugly message.
   */
  async authors({ request, serialize }: HttpContext) {
    const { limit } = await request.validateUsing(listReportedAuthorsValidator, {
      data: request.qs(),
    })

    return serialize({ authors: await listReportedAuthors(limit ?? DEFAULT_AUTHOR_LIMIT) })
  }

  /**
   * How many messages still have an unresolved report, for the queue's
   * badge in the admin navigation.
   */
  async openCount({ serialize }: HttpContext) {
    return serialize({ openReports: await openReportCount() })
  }

  /**
   * Closes every open report against one message, recording whether it
   * was actioned or dismissed.
   */
  async resolve({ auth, params, request, serialize }: HttpContext) {
    const { outcome, note } = await request.validateUsing(resolveReportValidator)
    const result = await resolveReportsForMessage(auth.getUserOrFail(), Number(params.messageId), {
      outcome,
      note,
    })

    return serialize(result)
  }

  /**
   * Reopens a message's reports when a resolution was the wrong call.
   */
  async reopen({ params, serialize }: HttpContext) {
    return serialize(await reopenReportsForMessage(Number(params.messageId)))
  }
}
