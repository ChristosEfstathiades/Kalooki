import ModerationAction from '#models/moderation_action'
import User from '#models/user'
import { findModerationTarget, setUserRole } from '#services/moderation_service'
import { buildUserDossier } from '#services/user_dossier_service'
import { listUsersValidator, setUserRoleValidator } from '#validators/moderation'
import { listModerationActionsValidator, parseIsoBound } from '#validators/admin'
import { moderationActionShape } from '#transformers/moderation_action_transformer'
import { moderationUserShape } from '#transformers/moderation_user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/** Users per page when the request does not ask for a different size. */
const DEFAULT_PER_PAGE = 25

/** Audit entries per page when the request does not ask for a size. */
const DEFAULT_ACTION_PER_PAGE = 50

/**
 * Endpoints backing the admin app on admin.{domain}. Every route here
 * is behind `middleware.role('admin')`, so moderators cannot reach them
 * (docs/features.md, Roles & Moderation).
 */
export default class AdminController {
  /**
   * Paginated list of every account, newest first, optionally filtered
   * by a username/email search term or by role. Pagination is returned
   * as explicit meta rather than a Lucid paginator so the generated
   * client keeps the response's shape.
   */
  async listUsers({ request, serialize }: HttpContext) {
    const { page, perPage, search, role } = await request.validateUsing(listUsersValidator, {
      data: request.qs(),
    })

    const query = User.query().orderBy('createdAt', 'desc')
    if (role) {
      query.where('role', role)
    }
    if (search) {
      const term = `%${search.toLowerCase()}%`
      query.where((builder) => {
        builder.whereRaw('lower(username) like ?', [term]).orWhereRaw('lower(email) like ?', [term])
      })
    }

    const paginator = await query.paginate(page ?? 1, perPage ?? DEFAULT_PER_PAGE)

    return serialize({
      users: paginator.all().map(moderationUserShape),
      meta: {
        page: paginator.currentPage,
        perPage: paginator.perPage,
        total: paginator.total,
        lastPage: paginator.lastPage,
      },
    })
  }

  /**
   * The full dossier for one account: play record, recent chat, the
   * reports for and against them, and their moderation history — so a
   * ban or mute is decided on the record rather than on the single
   * message that happened to be reported.
   */
  async showUser({ params, serialize }: HttpContext) {
    const target = await findModerationTarget(Number(params.userId))
    return serialize(await buildUserDossier(target))
  }

  /**
   * Promotes or demotes a user. Admins cannot change their own role, so
   * the last admin can never lock themselves out.
   */
  async updateUserRole({ auth, params, request, serialize }: HttpContext) {
    const { role } = await request.validateUsing(setUserRoleValidator)
    const target = await findModerationTarget(Number(params.userId))
    await setUserRole(auth.getUserOrFail(), target, role)

    return serialize({ user: moderationUserShape(target) })
  }

  /**
   * The moderation audit trail, newest first, filterable by action
   * type, by the acting or targeted username, and by date range.
   */
  async listModerationActions({ request, serialize }: HttpContext) {
    const filters = await request.validateUsing(listModerationActionsValidator, {
      data: request.qs(),
    })

    const query = ModerationAction.query().orderBy('createdAt', 'desc').orderBy('id', 'desc')

    if (filters.action) {
      query.where('action', filters.action)
    }
    if (filters.actor) {
      query.whereRaw('lower(actor_username) like ?', [`%${filters.actor.toLowerCase()}%`])
    }
    if (filters.target) {
      query.whereRaw('lower(target_username) like ?', [`%${filters.target.toLowerCase()}%`])
    }

    const from = parseIsoBound(filters.from, 'from')
    if (from) {
      query.where('createdAt', '>=', from.toSQL() ?? '')
    }
    const to = parseIsoBound(filters.to, 'to')
    if (to) {
      query.where('createdAt', '<', to.toSQL() ?? '')
    }

    const paginator = await query.paginate(
      filters.page ?? 1,
      filters.perPage ?? DEFAULT_ACTION_PER_PAGE
    )

    return serialize({
      actions: paginator.all().map(moderationActionShape),
      meta: {
        page: paginator.currentPage,
        perPage: paginator.perPage,
        total: paginator.total,
        lastPage: paginator.lastPage,
      },
    })
  }
}
