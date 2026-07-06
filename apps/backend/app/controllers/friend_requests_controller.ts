import FriendRequest from '#models/friend_request'
import { sendFriendRequestValidator } from '#validators/friend'
import { areFriends, createFriendship } from '#services/friendship_service'
import { findByExactUsername } from '#services/user_lookup'
import FriendRequestTransformer from '#transformers/friend_request_transformer'
import PublicUserTransformer from '#transformers/public_user_transformer'
import db from '@adonisjs/lucid/services/db'
import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export default class FriendRequestsController {
  /**
   * Lists the user's pending friend requests: incoming (to accept or
   * decline) and outgoing (cancellable).
   */
  async index({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const incoming = await FriendRequest.query()
      .where('recipientId', user.id)
      .preload('sender')
      .preload('recipient')
      .orderBy('createdAt', 'desc')
    const outgoing = await FriendRequest.query()
      .where('senderId', user.id)
      .preload('sender')
      .preload('recipient')
      .orderBy('createdAt', 'desc')

    return serialize({
      incoming: FriendRequestTransformer.transform(incoming),
      outgoing: FriendRequestTransformer.transform(outgoing),
    })
  }

  /**
   * Sends a friend request to the exact username provided. No partial
   * matching: an unknown username is an error, never a suggestion list.
   */
  async store({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { username } = await request.validateUsing(sendFriendRequestValidator)

    const recipient = await findByExactUsername(username)
    if (!recipient) {
      throw new Exception('No player found with that exact username', {
        status: 404,
        code: 'E_USER_NOT_FOUND',
      })
    }
    if (recipient.id === user.id) {
      throw new Exception('You cannot send a friend request to yourself', {
        status: 400,
        code: 'E_SELF_REQUEST',
      })
    }
    if (await areFriends(user.id, recipient.id)) {
      throw new Exception(`You are already friends with ${recipient.username}`, {
        status: 409,
        code: 'E_ALREADY_FRIENDS',
      })
    }

    const existingOutgoing = await FriendRequest.query()
      .where('senderId', user.id)
      .where('recipientId', recipient.id)
      .first()
    if (existingOutgoing) {
      throw new Exception(`You already have a pending request to ${recipient.username}`, {
        status: 409,
        code: 'E_REQUEST_EXISTS',
      })
    }

    const existingIncoming = await FriendRequest.query()
      .where('senderId', recipient.id)
      .where('recipientId', user.id)
      .first()
    if (existingIncoming) {
      throw new Exception(
        `${recipient.username} has already sent you a friend request — accept it instead`,
        { status: 409, code: 'E_REQUEST_EXISTS_REVERSE' }
      )
    }

    const friendRequest = await FriendRequest.create({
      senderId: user.id,
      recipientId: recipient.id,
    })
    await friendRequest.load('sender')
    await friendRequest.load('recipient')

    return serialize({ request: FriendRequestTransformer.transform(friendRequest) })
  }

  /**
   * Accepts an incoming friend request: the two users become friends
   * and the request disappears.
   */
  async accept({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const friendRequest = await FriendRequest.query()
      .where('id', Number(params.id))
      .where('recipientId', user.id)
      .preload('sender')
      .first()
    if (!friendRequest) {
      throw new Exception('Friend request not found', { status: 404, code: 'E_REQUEST_NOT_FOUND' })
    }

    await db.transaction(async (trx) => {
      friendRequest.useTransaction(trx)
      await createFriendship(friendRequest.senderId, friendRequest.recipientId)
      await friendRequest.delete()
    })

    return serialize({ friend: PublicUserTransformer.transform(friendRequest.sender) })
  }

  /**
   * Deletes a pending request: the recipient declining it, or the
   * sender cancelling it. The other party is not notified.
   */
  async destroy({ auth, params, serialize }: HttpContext) {
    const user = auth.getUserOrFail()

    const friendRequest = await FriendRequest.query()
      .where('id', Number(params.id))
      .where((query) => {
        query.where('senderId', user.id).orWhere('recipientId', user.id)
      })
      .first()
    if (!friendRequest) {
      throw new Exception('Friend request not found', { status: 404, code: 'E_REQUEST_NOT_FOUND' })
    }

    await friendRequest.delete()
    return serialize({ message: 'Friend request removed' })
  }
}
