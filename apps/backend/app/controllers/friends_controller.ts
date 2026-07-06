import { friendsOf, removeFriendship } from '#services/friendship_service'
import PublicUserTransformer from '#transformers/public_user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class FriendsController {
  /**
   * Lists the user's friends.
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const friends = await friendsOf(user.id)
    return serialize({ friends: PublicUserTransformer.transform(friends) })
  }

  /**
   * Removes a friend connection. Removal is silent and mutual — the
   * other user is not notified (docs/features.md) — and idempotent.
   */
  async destroy({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    await removeFriendship(user.id, Number(params.userId))
    return serialize({ message: 'Friend removed' })
  }
}
