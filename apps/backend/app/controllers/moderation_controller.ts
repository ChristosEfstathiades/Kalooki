import {
  banUser,
  deleteChatMessage,
  findModerationTarget,
  muteUser,
  unbanUser,
  unmuteUser,
} from '#services/moderation_service'
import {
  banUserValidator,
  deleteMessageValidator,
  liftModerationValidator,
  muteUserValidator,
} from '#validators/moderation'
import { moderationUserShape } from '#transformers/moderation_user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Moderator actions, reachable from the player site's inline controls
 * as well as the admin app. Every route here is behind
 * `middleware.role('moderator')`, and the service layer additionally
 * enforces that the actor outranks the target.
 */
export default class ModerationController {
  /**
   * The moderation state of one user, so the UI can offer "ban" or
   * "unban" (and likewise for mutes) rather than guessing.
   */
  async showUser({ params, serialize }: HttpContext) {
    const target = await findModerationTarget(Number(params.userId))
    return serialize({ user: moderationUserShape(target) })
  }

  /**
   * Removes a message from the global chatroom or a live game's chat.
   */
  async destroyMessage({ auth, params, request, serialize }: HttpContext) {
    const { reason } = await request.validateUsing(deleteMessageValidator)
    const message = await deleteChatMessage(auth.getUserOrFail(), Number(params.id), reason)

    return serialize({ messageId: message.id, message: 'Message deleted' })
  }

  /**
   * Bans a user: the account remains but can no longer sign in.
   */
  async ban({ auth, params, request, serialize }: HttpContext) {
    const { reason } = await request.validateUsing(banUserValidator)
    const target = await findModerationTarget(Number(params.userId))
    await banUser(auth.getUserOrFail(), target, reason)

    return serialize({ user: moderationUserShape(target) })
  }

  /**
   * Lifts a ban.
   */
  async unban({ auth, params, request, serialize }: HttpContext) {
    const { reason } = await request.validateUsing(liftModerationValidator)
    const target = await findModerationTarget(Number(params.userId))
    await unbanUser(auth.getUserOrFail(), target, reason)

    return serialize({ user: moderationUserShape(target) })
  }

  /**
   * Mutes a user for a fixed number of minutes, or permanently when
   * durationMinutes is null.
   */
  async mute({ auth, params, request, serialize }: HttpContext) {
    const { durationMinutes, reason } = await request.validateUsing(muteUserValidator)
    const target = await findModerationTarget(Number(params.userId))
    await muteUser(auth.getUserOrFail(), target, { durationMinutes, reason })

    return serialize({ user: moderationUserShape(target) })
  }

  /**
   * Lifts a mute early.
   */
  async unmute({ auth, params, request, serialize }: HttpContext) {
    const { reason } = await request.validateUsing(liftModerationValidator)
    const target = await findModerationTarget(Number(params.userId))
    await unmuteUser(auth.getUserOrFail(), target, reason)

    return serialize({ user: moderationUserShape(target) })
  }
}
