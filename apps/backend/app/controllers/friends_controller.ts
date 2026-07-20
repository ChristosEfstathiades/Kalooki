import { friendsOf, removeFriendship } from '#services/friendship_service'
import FriendTransformer from '#transformers/friend_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class FriendsController {
  /**
   * Lists the user's friends, each flagged online or offline. The list
   * is a snapshot: the client keeps it current from the presence events
   * the socket server pushes.
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const friends = await friendsOf(user.id)
    return serialize({ friends: FriendTransformer.transform(friends) })
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
