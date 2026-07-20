import ModerationAction from '#models/moderation_action'
import User from '#models/user'
import { findModerationTarget, setUserRole } from '#services/moderation_service'
import { listUsersValidator, setUserRoleValidator } from '#validators/moderation'
import { moderationActionShape } from '#transformers/moderation_action_transformer'
import { moderationUserShape } from '#transformers/moderation_user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/** Users per page when the request does not ask for a different size. */
const DEFAULT_PER_PAGE = 25

/** Audit entries returned by the moderation feed. */
const ACTION_FEED_LIMIT = 50

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
   * The most recent moderator and admin actions, newest first.
   */
  async listModerationActions({ serialize }: HttpContext) {
    const actions = await ModerationAction.query()
      .orderBy('createdAt', 'desc')
      .orderBy('id', 'desc')
      .limit(ACTION_FEED_LIMIT)

    return serialize({ actions: actions.map(moderationActionShape) })
  }
}
